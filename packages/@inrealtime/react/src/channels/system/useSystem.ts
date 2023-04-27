import { useCallback, useEffect } from 'react'

import { uniqueId } from '../../core'
import { RealtimeWebSocketStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'

const PING_INTERVAL = 15000

export const useSystemChannel = ({
  webSocketStatus,
  useChannel,
}: {
  webSocketStatus: RealtimeWebSocketStatus
  useChannel: UseChannel
}) => {
  const { sendMessage } = useChannel({
    channel: 'system',
    onMessage: useCallback((message) => {
      if (message.type === 'ping') {
        sendMessage({
          messageId: uniqueId(),
          type: 'pong',
          ackMessageId: message.messageId,
        })
      }
    }, []),
    throttle: 100,
  })

  useEffect(() => {
    if (webSocketStatus !== RealtimeWebSocketStatus.Open) {
      return
    }

    const interval = setInterval(() => {
      sendMessage({
        messageId: uniqueId(),
        type: 'ping',
      })
    }, PING_INTERVAL) as any as number

    return () => {
      clearInterval(interval)
    }
  }, [webSocketStatus, sendMessage])
}
