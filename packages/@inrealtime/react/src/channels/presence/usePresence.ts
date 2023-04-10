import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  clone,
  isMap,
  PresenceClientResponse,
  PresenceSyncResponse,
  RealtimeMessage,
  uniqueId,
} from '../../core'
import { RealtimeWebSocketStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'
import { PatchMe, SubscribeCollaborators, SubscribeMe, UseCollaborators, UseMe } from './types'
import { useCollaboratorStore } from './useCollaboratorStore'
import { usePresenceStore } from './usePresenceStore'
import { mergeData } from './utils'

export enum PresenceStatus {
  Unready = 'Unready',
  Syncing = 'Syncing',
  Ready = 'Ready',
}

const ReplaceMessageType = 'replace'
const UpdateMessageType = 'update'

export type UsePresenceChannel<TRealtimePresenceData> = {
  status: PresenceStatus
  useCollaborators: UseCollaborators<TRealtimePresenceData>
  subscribeCollaborators: SubscribeCollaborators<TRealtimePresenceData>
  useMe: UseMe<TRealtimePresenceData>
  patchMe: PatchMe<TRealtimePresenceData>
  subscribeMe: SubscribeMe<TRealtimePresenceData>
}

export const usePresenceChannel = <TRealtimePresenceData>({
  webSocketStatus,
  webSocketStatusRef,
  useChannel,
  throttle,
}: {
  webSocketStatus: RealtimeWebSocketStatus
  webSocketStatusRef: MutableRefObject<RealtimeWebSocketStatus>
  useChannel: UseChannel
  throttle: number
}): UsePresenceChannel<TRealtimePresenceData> => {
  const [status, setStatus] = useState<PresenceStatus>(PresenceStatus.Unready)

  // The id of the current client
  const [presenceClientId, setPresenceClientId] = useState<string>()
  const presenceLoadedRef = useRef<boolean>(false)

  // Operations that were received between before sync
  const preSyncMessagesRef = useRef<PresenceClientResponse<TRealtimePresenceData>[]>([])

  // Create the collaborator and presence store
  const collaboratorStore = useCollaboratorStore<TRealtimePresenceData>()
  const presenceStore = usePresenceStore<TRealtimePresenceData>()

  // Apply a client message
  const applyPresenceClientResponse = useCallback(
    (response: PresenceClientResponse<TRealtimePresenceData>) => {
      switch (response.type) {
        case 'client_add':
          if (response.client.clientId === presenceClientId) {
            presenceStore.patch(({ presence }) => {
              response.client.data = presence.data

              // Send presence message update only if presence data has changed from '{}'
              if (
                !presence.data &&
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
          if (response.clientId === presenceClientId) {
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
          if (response.clientId === presenceClientId) {
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
    [presenceClientId, collaboratorStore.patch],
  )

  useEffect(() => {
    if (status !== PresenceStatus.Ready) {
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
        (status === PresenceStatus.Syncing || preSyncMessagesRef.current.length > 0) &&
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
            setPresenceClientId(syncResponse.me.clientId)

            setStatus(PresenceStatus.Ready)
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
    [
      status,
      setStatus,
      preSyncMessagesRef,
      setPresenceClientId,
      collaboratorStore.patch,
      applyPresenceClientResponse,
    ],
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
      presenceStore.patch(({ presence }) => {
        const clonedData = clone(data)
        return {
          ...presence,
          data: options?.replace ? clonedData : mergeData(presence.data, clonedData),
          dataUpdatedAt: new Date().toISOString(),
        }
      })

      // If presence hasn't been added or socket hasn't been opened we wait to send presence messages
      if (webSocketStatusRef.current !== RealtimeWebSocketStatus.Open) {
        console.warn('Cannot patch presence data before socket is opened.')
        return
      }

      if (!presenceLoadedRef.current) {
        console.warn('Cannot patch presence data before presence is loaded.')
        return
      }

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
    setPresenceClientId(undefined)
    preSyncMessagesRef.current = []
  }, [collaboratorStore.patch, presenceStore.patch])

  // Initial sync
  useEffect(() => {
    if (webSocketStatus !== RealtimeWebSocketStatus.Open) {
      setStatus(PresenceStatus.Unready)
      reset()
      return
    }

    setStatus(PresenceStatus.Syncing)
  }, [webSocketStatus])

  return {
    status: status,
    useCollaborators: collaboratorStore.useStore,
    subscribeCollaborators: collaboratorStore.subscribe,
    useMe: presenceStore.useStore,
    patchMe: patchMe,
    subscribeMe: presenceStore.subscribe,
  }
}
