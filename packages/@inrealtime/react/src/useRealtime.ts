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
import { GetRealtimeAuthToken } from './core'
import { RealtimeWebSocketStatus } from './socket/types'
import { useWebSocket } from './socket/useWebSocket'

export type UseRealtimeOptions = {
  documentId?: string
  getAuthToken?: GetRealtimeAuthToken
  publicAuthKey?: string
  autosave?: boolean
  throttle?: number
  _package?: {
    environment?: 'local' | 'development' | 'production'
    logging?: {
      conflicts?: boolean
      socketStatus?: boolean
      listFragmentIndexes?: boolean
      localOperations?: boolean
      remoteOperations?: boolean
    }
  }
}

export enum RealtimeDocumentStatus {
  Unready = 'Unready',
  Ready = 'Ready',
}

export enum RealtimeConnectionStatus {
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
        logging: _package?.logging,
        autosave,
      }),
    [],
  )

  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>(
    RealtimeConnectionStatus.Closed,
  )
  const [realtimeDocumentStatus, setRealtimeDocumentStatus] = useState<RealtimeDocumentStatus>(
    RealtimeDocumentStatus.Unready,
  )

  const { token, socketUrl } = useAuth({
    config,
    documentId,
    getAuthToken,
    publicAuthKey,
  })
  const {
    status: webSocketStatus,
    statusRef: webSocketStatusRef,
    useChannel,
  } = useWebSocket({ socketUrl, token, config })

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
  useSystemChannel({ useChannel })

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
    let updatedConnectionStatus: RealtimeConnectionStatus
    switch (webSocketStatus) {
      case RealtimeWebSocketStatus.Closed:
        updatedConnectionStatus = RealtimeConnectionStatus.Closed
        break
      case RealtimeWebSocketStatus.Connecting:
        updatedConnectionStatus = RealtimeConnectionStatus.Connecting
        break
      case RealtimeWebSocketStatus.Authenticating:
        updatedConnectionStatus = RealtimeConnectionStatus.Authenticating
        break
      case RealtimeWebSocketStatus.Open:
        updatedConnectionStatus = RealtimeConnectionStatus.Subscribing
        break
    }
    switch (documentStatus) {
      case DocumentStatus.Unready:
        break
      case DocumentStatus.Subscribing:
        updatedConnectionStatus = RealtimeConnectionStatus.Subscribing
        break
      case DocumentStatus.Ready:
        updatedConnectionStatus = RealtimeConnectionStatus.Ready
        break
    }

    // If presence is not ready we keep it at subscribing
    if (
      updatedConnectionStatus === RealtimeConnectionStatus.Ready &&
      presenceStatus !== PresenceStatus.Ready
    ) {
      updatedConnectionStatus = RealtimeConnectionStatus.Subscribing
    }

    // We may get that connection status is subscribing while realtime document status is ready even though autosave is off
    // This is because if presence is not ready we keep it at subscribing
    if (
      updatedConnectionStatus === RealtimeConnectionStatus.Ready ||
      documentEditStatus === DocumentEditStatus.Ready ||
      documentEditStatus === DocumentEditStatus.ReadyLocal
    ) {
      setRealtimeDocumentStatus(RealtimeDocumentStatus.Ready)
    } else {
      setRealtimeDocumentStatus(RealtimeDocumentStatus.Unready)
    }

    setConnectionStatus(updatedConnectionStatus)
  }, [webSocketStatus, documentStatus, documentEditStatus, presenceStatus])

  return {
    documentStatus: realtimeDocumentStatus,
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
