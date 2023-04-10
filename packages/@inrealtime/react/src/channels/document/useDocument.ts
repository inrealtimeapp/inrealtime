import { useCallback, useEffect, useRef, useState } from 'react'

import { RealtimeConfig } from '../../config'
import {
  DocumentOperationAckResponse,
  DocumentOperationsResponse,
  RealtimeMessage,
  uniqueId,
} from '../../core'
import { RealtimeWebSocketStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'
import { DocumentPatch } from './store/types'
import { useOperations } from './store/useOperations'

export enum DocumentStatus {
  Unready = 'Unready',
  Subscribing = 'Subscribing',
  Ready = 'Ready',
}

export const useDocumentChannel = <TRealtimeState>({
  config,
  webSocketStatus,
  useChannel,
  throttle: requestedThrottle,
}: {
  config: RealtimeConfig
  webSocketStatus: RealtimeWebSocketStatus
  useChannel: UseChannel
  throttle: number
}) => {
  const [throttle, setThrottle] = useState<number>(0)
  const [status, setStatus] = useState<DocumentStatus>(DocumentStatus.Unready)
  const statusRef = useRef<DocumentStatus>(DocumentStatus.Unready)
  const sendMessageRef = useRef<(message: RealtimeMessage) => void>()

  const { reset, sync, localStore, postAck, postOperations, groupMessagesOnSend } =
    useOperations<TRealtimeState>({
      config,
      status,
      sendMessageRef,
    })

  // Update throttle to the requested throttle
  // We want to begin with throttle 0 to get subscribe message out as soon as possible, but change to the requested throttle afterwards
  useEffect(() => {
    if (status !== DocumentStatus.Ready) {
      setThrottle(0)
      return
    }

    setThrottle(requestedThrottle)
  }, [status, requestedThrottle])

  // On document message
  const onDocumentMessage = useCallback(
    (message: RealtimeMessage) => {
      switch (message.type) {
        case 'sync':
          sync(message)
          setStatus(DocumentStatus.Ready)
          statusRef.current = DocumentStatus.Ready
          break
        case 'ack':
          postAck(message as DocumentOperationAckResponse)
          break
        case 'ops':
          postOperations(message as DocumentOperationsResponse)
          break
        default:
          console.warn(`Document message with type '${message.type}' unhandled.`)
          break
      }
    },
    [sync, postAck, postOperations],
  )

  const patch = useCallback(
    (fn: DocumentPatch<TRealtimeState>): void => {
      if (statusRef.current !== DocumentStatus.Ready) {
        console.warn(`Cannot patch document when document status is ${statusRef.current}.`)
        return
      }
      localStore.patch(fn)
    },
    [localStore],
  )

  // Hook the document channel
  const { sendMessage } = useChannel({
    channel: 'document',
    onMessage: onDocumentMessage,
    throttle,
    groupMessagesOnSend,
  })

  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // Initial subscription
  useEffect(() => {
    if (webSocketStatus !== RealtimeWebSocketStatus.Open) {
      setStatus(DocumentStatus.Unready)
      statusRef.current = DocumentStatus.Unready
      reset()
      return
    }

    setStatus(DocumentStatus.Subscribing)
    statusRef.current = DocumentStatus.Subscribing
    sendMessage({ messageId: uniqueId(), type: 'subscribe' })
  }, [webSocketStatus])

  return {
    status,
    useStore: localStore.useStore,
    patch,
    subscribe: localStore.subscribe,
  }
}
