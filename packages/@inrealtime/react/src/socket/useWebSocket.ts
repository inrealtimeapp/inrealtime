import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { RealtimeConfig } from '../config'
import { RealtimeMessage, RealtimeWebSocket, uniqueId } from '../core'
import { createMessageStore } from './createMessageStore'
import { MessageStore, RealtimeWebSocketStatus } from './types'
import { useMessages } from './useMessages'

export type UseChannel = ({
  channel,
  onMessage,
  throttle,
}: {
  channel: string
  onMessage: (realtimeMessage: RealtimeMessage) => void
  throttle: number
  groupMessagesOnSend?: (messages: RealtimeMessage[]) => RealtimeMessage[]
}) => {
  sendMessage(message: RealtimeMessage): void
}

export type UseWebSocket = {
  status: RealtimeWebSocketStatus
  statusRef: MutableRefObject<RealtimeWebSocketStatus>
  useChannel: UseChannel
}

export const useWebSocket = ({
  socketUrl,
  token,
  config,
}: {
  socketUrl?: string
  token?: string
  config: RealtimeConfig
}): UseWebSocket => {
  const [socketStatus, setSocketStatus] = useState<RealtimeWebSocketStatus>(
    RealtimeWebSocketStatus.Closed,
  )
  const socketStatusRef = useRef<RealtimeWebSocketStatus>(socketStatus)
  const [lastToken, setLastToken] = useState<string | undefined>()
  const messageStoreRef = useRef<MessageStore>(createMessageStore())
  const authChannelPrefix = 'auth'

  const realtimeWebSocketRef = useRef<RealtimeWebSocket>()
  const [reconnectCounter, setReconnectCounter] = useState<number>(0)

  // Create onChannel hook
  const useChannel = useMemo(
    () =>
      ({
        channel,
        onMessage,
        throttle,
        groupMessagesOnSend,
      }: {
        channel: string
        onMessage: (realtimeMessage: RealtimeMessage) => void
        throttle: number
        groupMessagesOnSend?: (messages: RealtimeMessage[]) => RealtimeMessage[]
      }) =>
        useRawChannel({
          realtimeWebSocketRef,
          messageStoreRef,
          channel,
          onMessage,
          throttle,
          groupMessagesOnSend,
        }),
    [],
  )

  const newRealtimeWebSocket = useCallback(() => {
    const realtimeWebSocket = new RealtimeWebSocket({
      onOpen: () => {
        if (realtimeWebSocketRef.current !== realtimeWebSocket) {
          return
        }

        if (config.logging.socketStatus) console.log('Socket status -> Authenticating')
        setSocketStatus(RealtimeWebSocketStatus.Authenticating)
        socketStatusRef.current = RealtimeWebSocketStatus.Authenticating
      },
      onConnecting: () => {
        if (realtimeWebSocketRef.current !== realtimeWebSocket) {
          return
        }

        if (config.logging.socketStatus) console.log('Socket status -> Connecting')
        setSocketStatus(RealtimeWebSocketStatus.Connecting)
        socketStatusRef.current = RealtimeWebSocketStatus.Connecting
      },
      onClose: () => {
        if (realtimeWebSocketRef.current !== realtimeWebSocket) {
          return
        }

        if (config.logging.socketStatus) console.log('Socket status -> Closed')
        setSocketStatus(RealtimeWebSocketStatus.Closed)
        socketStatusRef.current = RealtimeWebSocketStatus.Closed
        setLastToken(undefined as any)
      },
      onMessage: (channel, message) => {
        if (realtimeWebSocketRef.current !== realtimeWebSocket) {
          return
        }

        messageStoreRef.current.registerMessage(channel, message)
      },
      config,
    })

    return realtimeWebSocket
  }, [])

  // Try reconnections
  useEffect(() => {
    if (socketStatus !== RealtimeWebSocketStatus.Closed) {
      return
    }
    const interval = setInterval(() => {
      setReconnectCounter(reconnectCounter + 1)
    }, 500)
    return () => clearInterval(interval)
  }, [socketStatus, reconnectCounter])

  // Connect and re-connections
  useEffect(() => {
    if (!socketUrl) {
      return
    }

    const realtimeWebSocket = newRealtimeWebSocket()
    realtimeWebSocketRef.current = realtimeWebSocket
    realtimeWebSocket.setSocketUrl({ socketUrl })
    realtimeWebSocket.connect()
    return () => {
      if (config.logging.socketStatus)
        console.log('Closing due to change in socketUrl, reconnect or hot-reload')
      realtimeWebSocket.close()
    }
  }, [socketUrl, reconnectCounter])

  // Hook to retrieve auth messages
  const { sendMessage: sendAuthMessage } = useChannel({
    channel: authChannelPrefix,
    onMessage: useCallback(
      (message: RealtimeMessage) => {
        if (message.type !== 'token' || socketStatus !== RealtimeWebSocketStatus.Authenticating) {
          return
        }
        if (config.logging.socketStatus) console.log('Socket status -> Open')
        setSocketStatus(RealtimeWebSocketStatus.Open)
        socketStatusRef.current = RealtimeWebSocketStatus.Open
      },
      [socketStatus, token],
    ),
    throttle: 0,
  })

  // Send initial auth token
  useEffect(() => {
    if (socketStatus !== RealtimeWebSocketStatus.Authenticating) {
      return
    }

    setLastToken(token)
    sendAuthMessage({ type: 'token', messageId: uniqueId(), token })
  }, [sendAuthMessage, socketStatus, token])

  // Send updated tokens
  useEffect(() => {
    if (socketStatus !== RealtimeWebSocketStatus.Open || lastToken === token || !token) {
      return
    }

    setLastToken(token)
    sendAuthMessage({ type: 'token', messageId: uniqueId(), token })
  }, [sendAuthMessage, socketStatus, token, lastToken])

  return { status: socketStatus, statusRef: socketStatusRef, useChannel }
}

const useRawChannel = ({
  realtimeWebSocketRef,
  messageStoreRef,
  channel,
  onMessage,
  throttle,
  groupMessagesOnSend,
}: {
  realtimeWebSocketRef: MutableRefObject<RealtimeWebSocket>
  messageStoreRef: MutableRefObject<MessageStore>
  channel: string
  onMessage: (message: RealtimeMessage) => void
  throttle: number
  groupMessagesOnSend?: (messages: RealtimeMessage[]) => RealtimeMessage[]
}): { sendMessage(message: RealtimeMessage): void } => {
  const messageQueueRef = useRef<RealtimeMessage[]>([])
  const sendMessagesInterval = useRef<number>()

  useMessages(
    messageStoreRef.current,
    channel,
    useCallback(
      (message: RealtimeMessage) => {
        onMessage(message)
      },
      [onMessage],
    ),
  )

  // Send messages
  useEffect(() => {
    sendMessagesInterval.current = setInterval(() => {
      if (messageQueueRef.current.length === 0) {
        return
      }
      const messages = groupMessagesOnSend
        ? groupMessagesOnSend(messageQueueRef.current)
        : messageQueueRef.current
      if (!messages) {
        return
      }
      messageQueueRef.current = []
      messages.forEach((message) => realtimeWebSocketRef.current.sendMessage(channel, message))
    }, throttle)
    return () => clearInterval(sendMessagesInterval.current!)
  }, [throttle, channel, groupMessagesOnSend])

  const sendMessageCallback = useCallback((message: RealtimeMessage) => {
    messageQueueRef.current.push(message)
  }, [])
  return { sendMessage: sendMessageCallback }
}
