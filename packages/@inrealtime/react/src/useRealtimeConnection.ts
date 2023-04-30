import { useMemo } from 'react'

import { useAuth } from './auth/useAuth'
import { useBroadcastChannel } from './channels/broadcast/useBroadcast'
import { usePresenceChannel } from './channels/presence/usePresence'
import { useSystemChannel } from './channels/system/useSystem'
import { getRealtimeConfig, RealtimeConfig } from './config'
import { useWebSocket } from './socket/useWebSocket'
import { getThrottle } from './throttle'
import { RealtimeConnectionOptions } from './types'

export const useRealtimeConnection = <TRealtimePresenceData>({
  documentId,
  groupId,
  getAuthToken,
  publicAuthKey,
  throttle: throttleOption,
  autosave,
  _package,
}: RealtimeConnectionOptions) => {
  const config: RealtimeConfig = useMemo(
    () =>
      getRealtimeConfig({
        environment: _package?.environment,
        logging: _package?.logging,
        autosave,
      }),
    [],
  )
  const throttle = useMemo(() => getThrottle(throttleOption), [throttleOption])

  const { token, socketUrl } = useAuth({
    config,
    documentId,
    groupId,
    getAuthToken,
    publicAuthKey,
  })
  const {
    status: connectionStatus,
    statusRef: connectionStatusRef,
    useChannel,
  } = useWebSocket({ socketUrl, token, config })

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
    connectionStatus,
    connectionStatusRef,
    useChannel,
    throttle,
  })

  // Broadcast channel
  const { broadcast, useBroadcastListener } = useBroadcastChannel({
    connectionStatusRef,
    useChannel,
    throttle,
  })

  return {
    connectionStatus,
    connectionStatusRef,
    presenceStatus,
    useCollaborators,
    subscribeCollaborators,
    useMe,
    patchMe,
    subscribeMe,
    broadcast,
    useBroadcastListener,
    config,
    useChannel,
  }
}
