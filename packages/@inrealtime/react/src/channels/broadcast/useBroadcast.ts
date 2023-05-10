import { MutableRefObject, useCallback, useEffect, useMemo, useRef } from 'react'

import { BroadcastEventRequest, BroadcastEventResponse, uniqueId } from '../../core'
import { RealtimeConnectionStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'
import { BroadcastStore, createBroadcastStore } from './createBroadcastStore'
import { Broadcast, UseBroadcastListener } from './types'

export type UseBroadcastChannel = {
  broadcast: Broadcast
  useBroadcastListener: UseBroadcastListener
}

export const useBroadcastChannel = ({
  connectionStatusRef,
  useChannel,
  throttle,
}: {
  connectionStatusRef: MutableRefObject<RealtimeConnectionStatus>
  useChannel: UseChannel
  throttle: number
}): UseBroadcastChannel => {
  const broadcastStoreRef = useRef<BroadcastStore>(createBroadcastStore())

  const { sendMessage } = useChannel({
    channel: 'broadcast',
    onMessage: useCallback((message) => {
      if (message.type === 'broadcast') {
        broadcastStoreRef.current.registerEvent(message.event)
      }
    }, []),
    throttle,
  })

  const broadcast = useMemo(
    () => (type: string, options: { data?: any; recipientClientIds?: string[] }) => {
      if (connectionStatusRef.current !== RealtimeConnectionStatus.Open) {
        console.warn('Cannot send broadcast event when connection status is not open.')
        return
      }

      const event: BroadcastEventRequest = {
        type,
      }
      if (options?.data !== undefined) {
        event.data = options.data
      }
      if (options?.recipientClientIds) {
        event.recipientClientIds = options.recipientClientIds
      }

      sendMessage({
        messageId: uniqueId(),
        type: 'broadcast',
        event,
      })
    },
    [sendMessage],
  )

  const useBroadcastListener = useMemo(
    () => (onEvent: (event: BroadcastEventResponse) => void | Promise<void>) => {
      const callback = useCallback((event: BroadcastEventResponse) => onEvent(event), [onEvent])

      useEffect(() => {
        return broadcastStoreRef.current.subscribeToEvents(callback)
      }, [callback])
    },
    [],
  )

  return {
    broadcast,
    useBroadcastListener,
  }
}
