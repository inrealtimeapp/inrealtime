import { useEffect, useMemo, useState } from 'react'

import { useAuth } from './auth/useAuth'
import { useBroadcastChannel } from './channels/broadcast/useBroadcast'
import { DocumentStatus, useDocumentChannel } from './channels/document/useDocument'
import { PresenceStatus, usePresenceChannel } from './channels/presence/usePresence'
import { useSystemChannel } from './channels/system/useSystem'
import { getRealtimeConfig, RealtimeConfig } from './config'
import { GetAuthToken } from './core'
import { RealtimeWebSocketStatus } from './socket/types'
import { useWebSocket } from './socket/useWebSocket'

type UseRealtimeOptions = {
  documentId?: string
  getAuthToken?: GetAuthToken
  publicAuthKey?: string
  throttle?: number
  developerSettings?: {
    devtools?: boolean
  }
  _package?: {
    environment?: 'local' | 'development' | 'production'
    debug?: {
      conflicts?: boolean
    }
  }
}

export enum RealtimeStatus {
  Closed = 'Closed',
  Connecting = 'Connecting',
  Authenticating = 'Authenticating',
  Subscribing = 'Subscribing',
  Ready = 'Ready',
}

const DefaultThrottle = 50
const MinThrottle = 15
const MaxThrottle = 2000

const getThrottle = (throttle?: number): number => {
  if (throttle === undefined) {
    return DefaultThrottle
  }
  if (throttle < MinThrottle || throttle > MaxThrottle) {
    console.warn(
      `Throttle must be between '${MinThrottle}' and '${MaxThrottle}'. Defaulted to '${DefaultThrottle}'`,
    )
    return DefaultThrottle
  }
  return throttle
}

export const useRealtime = <TRealtimeState, TRealtimePresenceData>({
  documentId,
  getAuthToken,
  publicAuthKey,
  throttle,
  developerSettings,
  _package,
}: UseRealtimeOptions) => {
  const config: RealtimeConfig = useMemo(
    () =>
      getRealtimeConfig({
        environment: _package?.environment,
        debug: _package?.debug,
        developerSettings,
      }),
    [],
  )

  const [status, setStatus] = useState<RealtimeStatus>(RealtimeStatus.Closed)
  const { token, socketUrl } = useAuth({ config, documentId, getAuthToken, publicAuthKey })
  const {
    status: webSocketStatus,
    statusRef: webSocketStatusRef,
    useChannel,
  } = useWebSocket({ socketUrl, token })

  throttle = getThrottle(throttle)

  // Document channel
  const {
    status: documentStatus,
    useStore,
    patch,
    subscribe,
  } = useDocumentChannel<TRealtimeState>({ config, webSocketStatus, useChannel, throttle })

  // System channel
  useSystemChannel({ webSocketStatus, useChannel })

  // Presence channel
  const {
    status: presenceStatus,
    useCollaborators,
    subscribeCollaborators,
    useMe,
    patchMe,
    subscribeMe,
  } = usePresenceChannel<TRealtimePresenceData>({
    webSocketStatus,
    webSocketStatusRef,
    useChannel,
    throttle,
  })

  // Broadcast channel
  const { broadcast, useBroadcastListener } = useBroadcastChannel({
    webSocketStatusRef,
    useChannel,
    throttle,
  })

  useEffect(() => {
    let updatedStatus: RealtimeStatus
    switch (webSocketStatus) {
      case RealtimeWebSocketStatus.Closed:
        updatedStatus = RealtimeStatus.Closed
        break
      case RealtimeWebSocketStatus.Connecting:
        updatedStatus = RealtimeStatus.Connecting
        break
      case RealtimeWebSocketStatus.Authenticating:
        updatedStatus = RealtimeStatus.Authenticating
        break
      case RealtimeWebSocketStatus.Open:
        updatedStatus = RealtimeStatus.Subscribing
        break
    }
    switch (documentStatus) {
      case DocumentStatus.Unready:
        break
      case DocumentStatus.Subscribing:
        updatedStatus = RealtimeStatus.Subscribing
        break
      case DocumentStatus.Ready:
        updatedStatus = RealtimeStatus.Ready
        break
    }

    // If presence is not ready we keep it at subscribing
    if (updatedStatus === RealtimeStatus.Ready && presenceStatus !== PresenceStatus.Ready) {
      updatedStatus = RealtimeStatus.Subscribing
    }

    setStatus(updatedStatus)
  }, [webSocketStatus, documentStatus, presenceStatus])

  return {
    status,
    useStore,
    patch,
    subscribe,
    useCollaborators,
    subscribeCollaborators,
    useMe,
    patchMe,
    subscribeMe,
    broadcast,
    useBroadcastListener,
  }
}
