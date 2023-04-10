import { useCallback, useEffect, useRef } from 'react'

import { uniqueId } from '../../core'
import { RealtimeWebSocketStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'

const PING_INTERVAL = 10000
const PONG_TIMEOUT = 15000

export const useSystemChannel = ({
  webSocketStatus,
  useChannel,
}: {
  webSocketStatus: RealtimeWebSocketStatus
  useChannel: UseChannel
}) => {
  const pingIntervalRef = useRef<number | null>(null)
  const pongTimeoutRef = useRef<number | null>(null)

  const pong = () => {
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current)
    }
  }

  const { sendMessage } = useChannel({
    channel: 'system',
    onMessage: useCallback((message) => {
      if (message.type === 'pong') {
        pong()
      }
    }, []),
    throttle: 100,
  })

  const ping = () => {
    sendMessage({
      messageId: uniqueId(),
      type: 'ping',
    })

    pongTimeoutRef.current = setTimeout(onPongTimeout, PONG_TIMEOUT) as any as number
  }

  const onPongTimeout = () => {
    console.error('Pong timed out.')
  }

  useEffect(() => {
    if (webSocketStatus === RealtimeWebSocketStatus.Open && pingIntervalRef?.current === null) {
      pingIntervalRef.current = setInterval(ping, PING_INTERVAL) as any as number
    }

    return () => {
      if (pingIntervalRef?.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }
    }
  }, [webSocketStatus])
}
