import { useEffect, useMemo, useState } from 'react'

import { useAuth } from './auth/useAuth'
import { useBroadcastChannel } from './channels/broadcast/useBroadcast'
import {
  DocumentEditStatus,
  DocumentStatus,
  useDocumentChannel,
} from './channels/document/useDocument'
import { PresenceStatus, usePresenceChannel } from './channels/presence/usePresence'
import { useSystemChannel } from './channels/system/useSystem'
import { getRealtimeConfig, RealtimeConfig } from './config'
import { GetAuthToken } from './core'
import { RealtimeWebSocketStatus } from './socket/types'
import { useWebSocket } from './socket/useWebSocket'

export type UseRealtimeOptions = {
  documentId?: string
  getAuthToken?: GetAuthToken
  publicAuthKey?: string
  autosave?: boolean
  throttle?: number
  _package?: {
    environment?: 'local' | 'development' | 'production'
    debug?: {
      conflicts?: boolean
    }
  }
}

export enum RealtimeStatus {
  Unready = 'Unready',
  Ready = 'Ready',
}

export enum ConnectionStatus {
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
  autosave,
  throttle,
  _package,
}: UseRealtimeOptions) => {
  const config: RealtimeConfig = useMemo(
    () =>
      getRealtimeConfig({
        environment: _package?.environment,
        debug: _package?.debug,
        autosave,
      }),
    [],
  )

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.Closed,
  )
  const [status, setStatus] = useState<RealtimeStatus>(RealtimeStatus.Unready)

  const { token, socketUrl, projectId } = useAuth({
    config,
    documentId,
    getAuthToken,
    publicAuthKey,
  })
  const {
    status: webSocketStatus,
    statusRef: webSocketStatusRef,
    useChannel,
  } = useWebSocket({ socketUrl, token })

  throttle = getThrottle(throttle)

  // Document channel
  const {
    status: documentStatus,
    editStatus: documentEditStatus,
    useStore,
    patch,
    subscribe,
  } = useDocumentChannel<TRealtimeState>({
    config,
    webSocketStatus,
    useChannel,
    documentId,
    throttle,
  })

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
    let updatedConnectionStatus: ConnectionStatus
    switch (webSocketStatus) {
      case RealtimeWebSocketStatus.Closed:
        updatedConnectionStatus = ConnectionStatus.Closed
        break
      case RealtimeWebSocketStatus.Connecting:
        updatedConnectionStatus = ConnectionStatus.Connecting
        break
      case RealtimeWebSocketStatus.Authenticating:
        updatedConnectionStatus = ConnectionStatus.Authenticating
        break
      case RealtimeWebSocketStatus.Open:
        updatedConnectionStatus = ConnectionStatus.Subscribing
        break
    }
    switch (documentStatus) {
      case DocumentStatus.Unready:
        break
      case DocumentStatus.Subscribing:
        updatedConnectionStatus = ConnectionStatus.Subscribing
        break
      case DocumentStatus.Ready:
        updatedConnectionStatus = ConnectionStatus.Ready
        break
    }

    // If presence is not ready we keep it at subscribing
    if (
      updatedConnectionStatus === ConnectionStatus.Ready &&
      presenceStatus !== PresenceStatus.Ready
    ) {
      updatedConnectionStatus = ConnectionStatus.Subscribing
    }

    if (
      updatedConnectionStatus === ConnectionStatus.Ready ||
      documentEditStatus === DocumentEditStatus.Ready ||
      documentEditStatus === DocumentEditStatus.ReadyLocal
    ) {
      setStatus(RealtimeStatus.Ready)
    } else {
      setStatus(RealtimeStatus.Unready)
    }

    setConnectionStatus(updatedConnectionStatus)
  }, [webSocketStatus, documentStatus, documentEditStatus, presenceStatus])

  return {
    status,
    connectionStatus,
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
