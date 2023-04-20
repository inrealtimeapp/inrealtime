import { MutableRefObject, useCallback, useEffect, useRef } from 'react'

import { RealtimeConfig } from '../../../config'
import {
  DocumentOperationAckResponse,
  DocumentOperationRequest,
  DocumentOperationsRequest,
  DocumentOperationsResponse,
  Fragment,
  RealtimeMessage,
  uniqueId,
} from '../../../core'
import { DocumentStatus } from '../useDocument'
import { areStoresEqual } from './tests/storeEqual'
import { useRealtimeStore } from './useRealtimeStore'
import { fragmentToDocument } from './utils/fragmentUtils'
import { minifyOperations } from './utils/minifyOperations'
import { createFragmentIdToPath } from './utils/pathUtils'
import { applyRemoteOperationsToStores } from './utils/remoteOperationUtils'

const OpsMessageType = 'ops'

/**
 * This hook does the following
 * - Maintains the two stores, local and remote
 * - Sends local changes to the server
 * - Takes changes from the server and applies them
 * - Fixes local and remote store conflicts
 * - Groups multiple messages into a single one (on throttle)
 */
export const useOperations = <TRealtimeState>({
  config,
  status,
  sendMessageRef,
}: {
  config: RealtimeConfig
  status: DocumentStatus
  sendMessageRef: MutableRefObject<((message: RealtimeMessage) => void) | undefined>
}) => {
  // All possible fragment ids that will need to be resolved
  const conflictsIdsRef = useRef<string[]>([])

  // All operations that have been unacked
  const unackedOperationsRef = useRef<DocumentOperationsRequest[]>([])

  // Operations that were received between subscribe and sync
  const preSyncReceivedOperationsRef = useRef<DocumentOperationsResponse[]>([])

  // Reset pre sync received operations when status changes to unready or subscribing
  useEffect(() => {
    if (status !== DocumentStatus.Unready && status !== DocumentStatus.Subscribing) {
      return
    }
    preSyncReceivedOperationsRef.current = []
  }, [status])

  // On local operations we want to send messages to the channel
  const onLocalPatchOperations = useCallback(
    (requests: DocumentOperationRequest[]) => {
      if (status !== DocumentStatus.Ready || !sendMessageRef.current || requests.length === 0) {
        return
      }
      const request: DocumentOperationsRequest = {
        messageId: uniqueId(),
        type: OpsMessageType,
        operations: requests,
      }

      const conflicts: string[] = []
      for (const op of request.operations) {
        switch (op.op) {
          case 'root':
            // We only need to check the root fragment id
            conflicts.push(op.value.id!)
            break
          case 'insert':
            // We need to check the parent for any index or map changes
            conflicts.push(op.parentId!)
            break
          case 'replace':
            // We need to check the current item and parent for any index or map changes
            // Order is important!
            conflicts.push(op.value.parentId!)
            conflicts.push(op.value.id!)
            break
          case 'move':
            // We only need to check parent for index integrity
            conflicts.push(op.parentId!)
            break
          case 'delete':
            // We only need to check parent for index integrity
            conflicts.push(op.parentId!)
            break
        }
      }

      conflictsIdsRef.current.push(...conflicts)
      unackedOperationsRef.current.push(request)
      sendMessageRef.current(request)
    },
    [status],
  )

  // Create stores
  const localStore = useRealtimeStore<TRealtimeState>({
    onPatchOperations: onLocalPatchOperations,
    devtools: config.developerSettings.devtools ? { name: 'Local store' } : undefined,
  })
  const remoteStore = useRealtimeStore<TRealtimeState>({
    devtools: config.developerSettings.devtools ? { name: 'Remote store' } : undefined,
  })

  // Reset
  const reset = useCallback(() => {
    conflictsIdsRef.current = []
    unackedOperationsRef.current = []
    preSyncReceivedOperationsRef.current = []
    localStore.setRoot({ document: undefined, fragment: undefined, fragmentIdToPath: undefined })
    remoteStore.setRoot({ document: undefined, fragment: undefined, fragmentIdToPath: undefined })
  }, [])

  // Sync document
  const sync = useCallback(
    (message: RealtimeMessage) => {
      const fragment = message.document as Fragment
      const document = fragmentToDocument({ fragment })
      const fragmentIdToPath = createFragmentIdToPath({ fragment })
      localStore.setRoot({ document, fragment, fragmentIdToPath: { ...fragmentIdToPath } })
      remoteStore.setRoot({ document, fragment, fragmentIdToPath: { ...fragmentIdToPath } })
      conflictsIdsRef.current = []
      unackedOperationsRef.current = []
    },
    [localStore, remoteStore],
  )

  // Apply all operations that were received in between subscribe and sync
  useEffect(() => {
    if (status !== DocumentStatus.Ready) {
      return
    }
    if (preSyncReceivedOperationsRef.current.length === 0) {
      return
    }

    applyRemoteOperationsToStores(preSyncReceivedOperationsRef.current, [localStore, remoteStore])
    preSyncReceivedOperationsRef.current = []
  }, [status, localStore])

  const postAck = useCallback(
    (ack: DocumentOperationAckResponse) => {
      const request = unackedOperationsRef.current.find((r) => r.messageId === ack.ackMessageId)!

      // Update any changes the server may have made to the request
      for (let opIndex = 0; opIndex < request.operations.length; ++opIndex) {
        const opMetadata = ack.opsMetadata?.[opIndex]
        if (!opMetadata) {
          continue
        }

        // Update index changes made by the server
        const operation = request.operations[opIndex]
        if (operation.op === 'insert' && opMetadata.parentListIndex !== undefined) {
          operation.parentListIndex = opMetadata.parentListIndex
          operation.value.parentListIndex = opMetadata.parentListIndex
        } else if (operation.op === 'replace' && opMetadata.parentListIndex !== undefined) {
          operation.value.parentListIndex = opMetadata.parentListIndex
        } else if (operation.op === 'move' && opMetadata.index !== undefined) {
          operation.index = opMetadata.index
        }

        // Remove ignored operations
        if (opMetadata.ignored) {
          request.operations[opIndex] = undefined as any
        }
      }
      request.operations = request.operations.filter((o) => !!o) // Filter out ignored operations

      // Remove the now acked operation
      unackedOperationsRef.current.splice(unackedOperationsRef.current.indexOf(request), 1)

      // Apply operation to remote
      applyRemoteOperationsToStores([request], [remoteStore])

      // If all messages have been acked resolve conflicts
      // This is done because we don't overwrite local content whilst the user is in the process of updating
      if (unackedOperationsRef.current.length === 0) {
        if (config.debug.conflicts) {
          console.log('Resolving conflicts')
        }

        localStore.resolveConflicts(conflictsIdsRef.current, remoteStore)
        conflictsIdsRef.current = []

        if (config.debug.conflicts) {
          const local = localStore.getRoot()
          const remote = remoteStore.getRoot()
          const storesEqual = areStoresEqual(
            {
              document: local.document,
              fragment: local.fragment,
              fragmentIdToPath: local.fragmentIdToPath,
            },
            {
              document: remote.document,
              fragment: remote.fragment,
              fragmentIdToPath: remote.fragmentIdToPath,
            },
          )

          if (
            !storesEqual.documentsEqual ||
            !storesEqual.fragmentsEqual ||
            !storesEqual.fragmentIdToPathsEqual
          ) {
            console.warn(
              'Conflicts not resolved. Remote and local are NOT equal!',
              'Previous request -> ',
              request,
            )
            if (!storesEqual.documentsEqual) {
              console.warn(
                'Documents not equal',
                JSON.parse(JSON.stringify(local.document)),
                JSON.parse(JSON.stringify(remote.document)),
              )
            }
            if (!storesEqual.fragmentsEqual) {
              console.warn(
                'Fragments not equal',
                JSON.parse(JSON.stringify(local.fragment)),
                JSON.parse(JSON.stringify(remote.fragment)),
              )
            }
            if (!storesEqual.fragmentIdToPathsEqual) {
              console.warn(
                'Fragment id to paths not equal',
                JSON.parse(JSON.stringify(local.fragmentIdToPath)),
                JSON.parse(JSON.stringify(remote.fragmentIdToPath)),
              )
            }
          } else {
            console.log('Conflicts resolved, remote and local are equal.')
          }
        }
      }
    },
    [localStore, remoteStore],
  )

  // Group messages and merge ops messages together
  const groupMessagesOnSend = useCallback((messages: RealtimeMessage[]): RealtimeMessage[] => {
    const notOpsMessages = messages.filter((m) => m.type !== OpsMessageType)

    const opsMessages = messages.filter(
      (m) => m.type === OpsMessageType,
    ) as DocumentOperationsRequest[]

    if (opsMessages.length === 0) {
      return notOpsMessages
    }

    // Flattened list of operations
    const operations = ([] as DocumentOperationRequest[]).concat(
      ...opsMessages.map((m) => m.operations),
    )

    // Minified operations
    const minifiedOperations = minifyOperations(operations) as DocumentOperationRequest[]

    // Create a single grouped message
    const groupedMessage: DocumentOperationsRequest = {
      messageId: uniqueId(),
      type: OpsMessageType,
      operations: minifiedOperations,
    }

    if (minifiedOperations.length > 0) {
      const opsIndex = unackedOperationsRef.current.indexOf(opsMessages[0])
      unackedOperationsRef.current.splice(opsIndex < 0 ? 0 : opsIndex, 0, groupedMessage)
    }
    unackedOperationsRef.current = unackedOperationsRef.current.filter(
      (opMessage) => !opsMessages.includes(opMessage),
    )

    if (minifiedOperations.length > 0) {
      return [...notOpsMessages, groupedMessage]
    }
    return notOpsMessages
  }, [])

  // Receive server operations
  const postOperations = useCallback(
    (response: DocumentOperationsResponse) => {
      if (
        status === DocumentStatus.Subscribing ||
        preSyncReceivedOperationsRef.current.length > 0
      ) {
        preSyncReceivedOperationsRef.current.push(response)
        return
      }

      if (status !== DocumentStatus.Ready) {
        return
      }

      applyRemoteOperationsToStores([response], [localStore, remoteStore])
    },
    [status, localStore, remoteStore],
  )

  return { reset, sync, localStore, remoteStore, postAck, postOperations, groupMessagesOnSend }
}
