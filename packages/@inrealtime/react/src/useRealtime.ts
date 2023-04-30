import { RealtimeConnectionOptions } from './types'
import { useRealtimeConnection } from './useRealtimeConnection'
import { useRealtimeDocument } from './useRealtimeDocument'

export const useRealtime = <TRealtimeState, TRealtimePresenceData>(
  options: RealtimeConnectionOptions,
) => {
  const {
    connectionStatus,
    presenceStatus,
    config,
    useChannel,
    useMe,
    useCollaborators,
    useBroadcastListener,
    patchMe,
    subscribeCollaborators,
    subscribeMe,
    broadcast,
  } = useRealtimeConnection<TRealtimePresenceData>(options)
  const { documentStatus, useStore, patch, subscribe } = useRealtimeDocument<TRealtimeState>({
    config,
    connectionStatus,
    useChannel,
    documentId: options.documentId,
    throttle: options.throttle,
  })

  return {
    documentStatus,
    connectionStatus,
    presenceStatus,
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
