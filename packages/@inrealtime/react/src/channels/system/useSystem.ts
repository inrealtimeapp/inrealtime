import { useCallback, useEffect, useRef } from 'react'

import { uniqueId } from '../../core'
import { RealtimeWebSocketStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'

const PING_INTERVAL = 7500
const PONG_TIMEOUT = 65000

export const useSystemChannel = ({
  webSocketStatus,
  useChannel,
}: {
  webSocketStatus: RealtimeWebSocketStatus
  useChannel: UseChannel
}) => {
  const pingIntervalRef = useRef<number | null>(null)
  const pongTimeoutRef = useRef<number | null>(null)

  const { sendMessage } = useChannel({
    channel: 'system',
    onMessage: useCallback((message) => {
      if (message.type === 'pong') {
        if (pongTimeoutRef.current !== null) {
          clearTimeout(pongTimeoutRef.current!)
        }
      }
    }, []),
    throttle: 100,
  })

  useEffect(() => {
    if (pingIntervalRef?.current !== null) {
      clearInterval(pingIntervalRef.current!)
      pingIntervalRef.current = null
    }
    if (pongTimeoutRef?.current !== null) {
      clearTimeout(pongTimeoutRef.current!)
      pongTimeoutRef.current = null
    }

    if (webSocketStatus === RealtimeWebSocketStatus.Open) {
      pingIntervalRef.current = setInterval(() => {
        sendMessage({
          messageId: uniqueId(),
          type: 'ping',
        })

        pongTimeoutRef.current = setTimeout(() => {
          console.warn('Pong timed out.')
        }, PONG_TIMEOUT) as any as number
      }, PING_INTERVAL) as any as number
    }

    return () => {
      if (pingIntervalRef?.current) {
        clearInterval(pingIntervalRef.current!)
        pingIntervalRef.current = null
      }
      if (pongTimeoutRef?.current !== null) {
        clearTimeout(pongTimeoutRef.current!)
        pongTimeoutRef.current = null
      }
    }
  }, [webSocketStatus, sendMessage])
}
