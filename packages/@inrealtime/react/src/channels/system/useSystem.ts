import { useCallback, useEffect } from 'react'

import { uniqueId } from '../../core'
import { UseChannel } from '../../socket/useWebSocket'

export const useSystemChannel = ({ useChannel }: { useChannel: UseChannel }) => {
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
}
