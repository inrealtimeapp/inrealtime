import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  clone,
  isMap,
  PresenceClientResponse,
  PresenceSyncResponse,
  RealtimeMessage,
  uniqueId,
} from '../../core'
import { RealtimeConnectionStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'
import { SubscribeVersions, UseVersions } from './types'
import { useVersionsStore } from './useVersionsStore'

export enum RealtimeVersionStatus {
  Unready = 'Unready',
  Syncing = 'Syncing',
  Ready = 'Ready',
}

export type UseVersionsChannel = {
  status: RealtimeVersionStatus
  useVersions: UseVersions
  subscribeVersions: SubscribeVersions
}

export const usePresenceChannel = ({
  connectionStatus,
  connectionStatusRef,
  useChannel,
  throttle,
}: {
  connectionStatus: RealtimeConnectionStatus
  connectionStatusRef: MutableRefObject<RealtimeConnectionStatus>
  useChannel: UseChannel
  throttle: number
}): UseVersionsChannel => {
  const [status, setStatus] = useState<RealtimeVersionStatus>(RealtimeVersionStatus.Unready)
  const statusRef = useRef<RealtimeVersionStatus>(RealtimeVersionStatus.Unready)

  // Operations that were received between before sync
  const preSyncMessagesRef = useRef<PresenceClientResponse<TRealtimePresenceData>[]>([])

  // Create the versions store
  const versionsStore = useVersionsStore()

  // Apply a client message
  const applyPresenceClientResponse = useCallback(
    (response: PresenceClientResponse<TRealtimePresenceData>) => {
      switch (response.type) {
        case 'client_add':
          if (response.client.clientId === presenceClientIdRef.current) {
            presenceStore.patch(({ presence }) => {
              response.client.data = presence.data

              // Send presence message update only if presence data has changed from '{}'
              if (
                presence.data &&
                isMap(presence.data) &&
                Object.keys(presence.data as { [key: string]: any }).length === 0
              ) {
                return response.client
              }

              sendMessage({
                messageId: uniqueId(),
                type: ReplaceMessageType,
                data: clone(presence.data),
              })
              return response.client
            })

            setStatus(RealtimePresenceStatus.Ready)
            statusRef.current = RealtimePresenceStatus.Ready
            presenceLoadedRef.current = true
            break
          }

          collaboratorStore.patch(({ presences }) => {
            presences = presences.filter((p) => p.clientId !== response.client.clientId) // Filter to avoid duplicates
            presences.push(response.client)
            return presences
          })
          break
        case 'client_remove':
          collaboratorStore.patch(({ presences }) => {
            presences = presences.filter((p) => p.clientId !== response.clientId)
            return presences
          })
          break
        case 'client_replace_metadata':
          // Local client
          if (response.clientId === presenceClientIdRef.current) {
            presenceStore.patch(({ presence }) => ({ ...presence, metadata: response.metadata }))
            break
          }

          // Collaborators
          collaboratorStore.patch(({ presences }) => {
            const index = presences.findIndex((p) => p.clientId === response.clientId)
            if (index < 0) {
              return presences
            }

            // We must replace it for selector to work properly
            presences[index] = { ...presences[index], metadata: response.metadata }
            return presences
          })
          break

        case 'client_replace_data':
        case 'client_update_data':
          // Local client
          if (response.clientId === presenceClientIdRef.current) {
            // We don't need to update local client as it will always have the newest updates as it can only update the data
            break
          }

          // Collaborators
          collaboratorStore.patch(({ presences }) => {
            const index = presences.findIndex((p) => p.clientId === response.clientId)
            if (index < 0) {
              return presences
            }

            // We must replace it for selector to work properly
            presences[index] = {
              ...presences[index],
              data:
                response.type === 'client_replace_data'
                  ? response.data
                  : mergeData(presences[index].data, response.data),
              dataUpdatedAt: response.dataUpdatedAt,
            }
            return presences
          })
          break
      }
    },
    [],
  )

  useEffect(() => {
    if (status !== RealtimePresenceStatus.Ready) {
      return
    }

    // Apply all messages which occurred between connecting and sync
    preSyncMessagesRef.current.forEach((msg) => applyPresenceClientResponse(msg))
    preSyncMessagesRef.current = []
  }, [status])

  // On presence message
  const onPresenceMessage = useCallback(
    (message: RealtimeMessage) => {
      if (
        ((statusRef.current === RealtimePresenceStatus.Syncing && !presenceClientIdRef.current) ||
          preSyncMessagesRef.current.length > 0) &&
        message.type.startsWith('client_')
      ) {
        preSyncMessagesRef.current.push(message as PresenceClientResponse<TRealtimePresenceData>)
        return
      }

      switch (message.type) {
        case 'sync':
          {
            // Update local store as clients in the sync message
            const syncResponse = message as PresenceSyncResponse<TRealtimePresenceData>
            collaboratorStore.patch(({}) => syncResponse.clients)

            // Update my client id
            presenceClientIdRef.current = syncResponse.me.clientId
          }
          break
        case 'client_add':
        case 'client_remove':
        case 'client_replace_metadata':
        case 'client_update_data':
        case 'client_replace_data':
          applyPresenceClientResponse(message as PresenceClientResponse<TRealtimePresenceData>)
          break
        default:
          console.warn(`Presence message with type '${message.type}' unhandled.`)
          break
      }
    },
    [applyPresenceClientResponse],
  )

  // Grouping multiple messages in the presence channel
  const groupMessagesOnSend = useCallback((messages: RealtimeMessage[]): RealtimeMessage[] => {
    if (!messages) {
      return []
    }

    // Convert multiple messages into one
    /**
     * If any replace message exists, we will always have a replacement message outgoing
     * Then we can just merge each update
     */
    const newMessage = messages[0]
    for (const message of messages) {
      if (message.type === ReplaceMessageType) {
        newMessage.type = ReplaceMessageType
        newMessage.data = message.data
        continue
      }

      newMessage.data = mergeData(newMessage.data, message.data)
    }

    return [newMessage]
  }, [])

  // Hook the presence channel
  const { sendMessage } = useChannel({
    channel: 'presence',
    onMessage: onPresenceMessage,
    throttle,
    groupMessagesOnSend: groupMessagesOnSend,
  })

  // Patch me for replacing or updating one-self
  const patchMe: PatchMe<TRealtimePresenceData> = useMemo(() => {
    return (data: Partial<TRealtimePresenceData>, options?: { replace?: boolean }) => {
      // If presence hasn't been added or socket hasn't been opened we wait to send presence messages
      if (connectionStatusRef.current !== RealtimeConnectionStatus.Open) {
        console.warn('Cannot patch presence data before connection is open.')
        return
      }

      if (!presenceLoadedRef.current) {
        console.warn('Cannot patch presence data before presence is ready.')
        return
      }

      presenceStore.patch(({ presence }) => {
        const clonedData = clone(data)
        return {
          ...presence,
          data: options?.replace ? clonedData : mergeData(presence.data, clonedData),
          dataUpdatedAt: new Date().toISOString(),
        }
      })

      sendMessage({
        messageId: uniqueId(),
        type: options?.replace ? ReplaceMessageType : UpdateMessageType,
        data: clone(data),
      })
    }
  }, [sendMessage])

  // Reset
  const reset = useCallback(() => {
    collaboratorStore.reset()
    presenceStore.reset()
    presenceClientIdRef.current = undefined as any
    preSyncMessagesRef.current = []
  }, [])

  // Initial sync
  useEffect(() => {
    if (
      connectionStatus === RealtimeConnectionStatus.Open &&
      statusRef.current !== RealtimePresenceStatus.Unready
    ) {
      return
    }

    if (
      connectionStatus !== RealtimeConnectionStatus.Open &&
      connectionStatus !== RealtimeConnectionStatus.Authenticating
    ) {
      setStatus(RealtimePresenceStatus.Unready)
      statusRef.current = RealtimePresenceStatus.Unready
      reset()
      return
    }

    setStatus(RealtimePresenceStatus.Syncing)
    statusRef.current = RealtimePresenceStatus.Syncing
  }, [connectionStatus])

  return {
    status: status,
    useCollaborators: collaboratorStore.useStore,
    subscribeCollaborators: collaboratorStore.subscribe,
    useMe: presenceStore.useStore,
    patchMe: patchMe,
    subscribeMe: presenceStore.subscribe,
  }
}
