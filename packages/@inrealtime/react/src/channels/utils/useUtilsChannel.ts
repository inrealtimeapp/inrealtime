import { useCallback, useRef } from 'react'

import { uniqueId } from '../../core'
import { UseChannel } from '../../socket/useWebSocket'

export type DuplicateDocumentId = { sourceDocumentId: string; destinationDocumentId: string }
export type DuplicateDocumentOptions = {
  replaceStrings?: { [key: string]: string }
  removeKeys?: {
    path: string[]
    ifNotInList?: string[]
  }[]
}

export type DuplicateDocument = (
  documentIds: DuplicateDocumentId[],
  options?: DuplicateDocumentOptions,
) => Promise<DuplicateDocumentId[]>

export const useUtilsChannel = ({
  useChannel,
}: {
  useChannel: UseChannel
}): { duplicate: DuplicateDocument } => {
  const duplicatePromisesRef = useRef<{
    [key: string]: (value: DuplicateDocumentId[] | PromiseLike<DuplicateDocumentId[]>) => void
  }>({})

  const { sendMessage } = useChannel({
    channel: 'utils',
    onMessage: useCallback((message) => {
      if (message.type === 'duplicated') {
        duplicatePromisesRef.current[message.ackMessageId ?? '']?.(message.documentIds)
      }
    }, []),
    throttle: 10,
  })

  const duplicate = useCallback(
    (
      documentIds: DuplicateDocumentId[],
      options?: DuplicateDocumentOptions,
    ): Promise<DuplicateDocumentId[]> => {
      const messageId = uniqueId()

      // Duplicate promise
      const promise = new Promise<DuplicateDocumentId[]>((resolve, reject) => {
        duplicatePromisesRef.current[messageId] = resolve
        options = options ?? {}
        sendMessage({
          messageId,
          type: 'duplicate',
          documentIds,
          ...options,
        })
      })

      // Timeout after 10 seconds
      const timeoutPromise = new Promise<DuplicateDocumentId[]>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout duplicating.'))
          delete duplicatePromisesRef.current[messageId]
        }, 60000)
      })

      // Race the original promise against the timeout promise
      return Promise.race([promise, timeoutPromise])
    },
    [sendMessage],
  )

  return { duplicate }
}
