import { useCallback, useEffect, useRef, useState } from 'react'

import { RealtimeConfig } from '../../config'
import {
  DocumentOperationAckResponse,
  DocumentOperationRequest,
  DocumentOperationsRequest,
  DocumentOperationsResponse,
  Fragment,
  FragmentTypeList,
  FragmentTypeMap,
  RealtimeMessage,
  uniqueId,
} from '../../core'
import { RealtimeConnectionStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'
import { useDocumentAutosave } from './autosave/useDocumentAutosave'
import { areStoresEqual } from './store/tests/storeEqual'
import { DocumentPatch } from './store/types'
import { useRealtimeStore } from './store/useRealtimeStore'
import { fragmentToDocument } from './store/utils/fragmentUtils'
import { minifyOperations } from './store/utils/minifyOperations'
import { createFragmentIdToPath } from './store/utils/pathUtils'
import { applyRemoteOperationsToStores } from './store/utils/remoteOperationUtils'

export const OpsMessageType = 'ops'
const MaxOpsPerMessage = 30

export enum DocumentSubscriptionStatus {
  Unready = 'Unready',
  Subscribing = 'Subscribing',
  Ready = 'Ready',
}

export enum DocumentAvailabilityStatus {
  Unready = 'Unready',
  ReadyLocal = 'ReadyLocal',
  Ready = 'Ready',
}

export const useDocumentChannel = <TRealtimeState>({
  config,
  connectionStatus,
  useChannel,
  documentId,
  throttle: requestedThrottle,
}: {
  config: RealtimeConfig
  connectionStatus: RealtimeConnectionStatus
  useChannel: UseChannel
  documentId?: string
  throttle: number
}) => {
  const [subscriptionStatus, setSubscriptionSubscriptionStatus] =
    useState<DocumentSubscriptionStatus>(DocumentSubscriptionStatus.Unready)
  const subscriptionStatusRef = useRef<DocumentSubscriptionStatus>(
    DocumentSubscriptionStatus.Unready,
  )

  const [availabilityStatus, setAvailabilityStatus] = useState<DocumentAvailabilityStatus>(
    DocumentAvailabilityStatus.Unready,
  )
  const availabilityStatusRef = useRef<DocumentAvailabilityStatus>(
    DocumentAvailabilityStatus.Unready,
  )

  const [throttle, setThrottle] = useState<number>(0)
  const sendMessageRef = useRef<(message: RealtimeMessage) => void>()
  const documentIdRef = useRef<string | undefined>(documentId)

  // Operations that were received between subscribe and sync
  const preSyncReceivedOperationsRef = useRef<DocumentOperationsResponse[]>([])

  // All possible fragment ids that will need to be resolved
  const conflictsIdsRef = useRef<string[]>([])

  // All operations that have been unacked
  const unackedOperationsRef = useRef<DocumentOperationsRequest[]>([])

  // Save local changes ref
  const saveLocalChangesRef = useRef<(request: DocumentOperationsRequest) => void>()

  useEffect(() => {
    documentIdRef.current = documentId
  }, [documentId])

  // Send operations to the channel
  const sendOperations = useCallback((request: DocumentOperationsRequest) => {
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
    sendMessageRef.current!(request)
  }, [])

  // On local operations we want to send messages to the channel
  const onLocalPatchOperations = useCallback((requests: DocumentOperationRequest[]) => {
    if (
      (availabilityStatusRef.current !== DocumentAvailabilityStatus.Ready &&
        availabilityStatusRef.current !== DocumentAvailabilityStatus.ReadyLocal) ||
      requests.length === 0
    ) {
      return
    }

    const request: DocumentOperationsRequest = {
      messageId: uniqueId(),
      documentId: documentIdRef.current!,
      type: OpsMessageType,
      operations: requests,
    }

    if (saveLocalChangesRef.current) {
      saveLocalChangesRef.current!(request)
    }

    if (subscriptionStatusRef.current !== DocumentSubscriptionStatus.Ready) {
      return
    }

    sendOperations(request)
  }, [])

  // Create stores
  const localStore = useRealtimeStore<TRealtimeState>({
    onPatchOperations: onLocalPatchOperations,
    name: 'local',
    config,
  })
  const remoteStore = useRealtimeStore<TRealtimeState>({
    name: 'local',
    config,
  })

  // Create autosave
  const {
    saveLocalChanges,
    markForLocalSaving,
    updateLocalChanges,
    getLocalChangesToSync,
    acknowledgeLocalChange,
  } = useDocumentAutosave({
    config,
    documentId,
    localStore,
    onLocalData: useCallback((fragment) => {
      if (availabilityStatusRef.current === DocumentAvailabilityStatus.Ready) {
        return
      }
      if (fragment.type !== FragmentTypeList && fragment.type !== FragmentTypeMap) {
        return
      }

      const document = fragmentToDocument({ fragment })
      const fragmentIdToPath = createFragmentIdToPath({ fragment })
      localStore.setRoot({
        document,
        fragment,
        fragmentIdToPath: { ...fragmentIdToPath },
      })
      conflictsIdsRef.current = []
      unackedOperationsRef.current = []

      setAvailabilityStatus(DocumentAvailabilityStatus.ReadyLocal)
      availabilityStatusRef.current = DocumentAvailabilityStatus.ReadyLocal
    }, []),
    onNoLocalData: useCallback(() => {
      if (availabilityStatusRef.current === DocumentAvailabilityStatus.Ready) {
        return
      }

      conflictsIdsRef.current = []
      unackedOperationsRef.current = []

      setAvailabilityStatus(DocumentAvailabilityStatus.Unready)
      availabilityStatusRef.current = DocumentAvailabilityStatus.Unready
    }, []),
  })

  // Update save local changes ref
  useEffect(() => {
    saveLocalChangesRef.current = saveLocalChanges
  }, [saveLocalChanges])

  // Update throttle to the requested throttle
  // We want to begin with throttle 0 to get subscribe message out as soon as possible, but change to the requested throttle afterwards
  useEffect(() => {
    if (subscriptionStatus !== DocumentSubscriptionStatus.Ready) {
      setThrottle(0)
      return
    }

    setThrottle(requestedThrottle)
  }, [subscriptionStatus, requestedThrottle])

  // On sync message
  const onSyncMessage = useCallback((fragment: Fragment) => {
    // Get local changes. We must get them before setting root of local store
    const localChanges = getLocalChangesToSync()

    // Sync documents and fragments
    const document = fragmentToDocument({ fragment })
    const fragmentIdToPath = createFragmentIdToPath({ fragment })
    localStore.setRoot({ document, fragment, fragmentIdToPath: { ...fragmentIdToPath } })
    remoteStore.setRoot({ document, fragment, fragmentIdToPath: { ...fragmentIdToPath } })
    conflictsIdsRef.current = []
    unackedOperationsRef.current = []

    // Apply any operations that were received before the sync
    if (preSyncReceivedOperationsRef.current.length > 0) {
      applyRemoteOperationsToStores(preSyncReceivedOperationsRef.current, [localStore, remoteStore])
      preSyncReceivedOperationsRef.current = []
    }

    // Apply any local changes and send them to the channel
    if (localChanges.length > 0) {
      applyRemoteOperationsToStores(localChanges, [localStore])
      for (const request of localChanges) {
        sendOperations(request)
      }
    }

    setSubscriptionSubscriptionStatus(DocumentSubscriptionStatus.Ready)
    setAvailabilityStatus(DocumentAvailabilityStatus.Ready)
    subscriptionStatusRef.current = DocumentSubscriptionStatus.Ready
    availabilityStatusRef.current = DocumentAvailabilityStatus.Ready

    markForLocalSaving()
  }, [])

  // On ack message
  const onAckMessage = useCallback((ack: DocumentOperationAckResponse) => {
    if (subscriptionStatusRef.current !== DocumentSubscriptionStatus.Ready) {
      return
    }

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

    // Acknowledge local change
    acknowledgeLocalChange(ack.ackMessageId)

    // If all messages have been acked resolve conflicts
    // This is done because we don't overwrite local content whilst the user is in the process of updating
    if (unackedOperationsRef.current.length === 0) {
      if (config.logging.conflicts) {
        console.log('Resolving conflicts')
      }

      localStore.resolveConflicts(conflictsIdsRef.current, remoteStore)
      conflictsIdsRef.current = []

      if (config.logging.conflicts) {
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
  }, [])

  // On operations message
  const onOpsMessage = useCallback((message: DocumentOperationsResponse) => {
    // All operations that were received in between subscribe and sync are applied when sync completes
    if (subscriptionStatusRef.current === DocumentSubscriptionStatus.Subscribing) {
      preSyncReceivedOperationsRef.current.push(message)
      return
    }

    if (subscriptionStatusRef.current !== DocumentSubscriptionStatus.Ready) {
      return
    }

    applyRemoteOperationsToStores([message], [localStore, remoteStore])
    markForLocalSaving()
  }, [])

  // On document message
  const onDocumentMessage = useCallback(
    (message: RealtimeMessage) => {
      switch (message.type) {
        case 'sync':
          onSyncMessage(message.document)
          break
        case 'ack':
          onAckMessage(message as DocumentOperationAckResponse)
          break
        case 'ops':
          onOpsMessage(message as DocumentOperationsResponse)
          break
        default:
          console.warn(`Document message with type '${message.type}' unhandled.`)
          break
      }
    },
    [onSyncMessage, onAckMessage, onOpsMessage],
  )

  // Patch document
  const patch = useCallback(
    (fn: DocumentPatch<TRealtimeState>): void => {
      if (
        availabilityStatusRef.current !== DocumentAvailabilityStatus.Ready &&
        availabilityStatusRef.current !== DocumentAvailabilityStatus.ReadyLocal
      ) {
        console.warn(
          `Cannot patch document when document edit status is ${availabilityStatusRef.current}.`,
        )
        return
      }
      localStore.patch(fn)
    },
    [localStore],
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

    // Create grouped messages based on chunk size
    const groupedMessages: DocumentOperationsRequest[] = []
    for (let i = 0; i < minifiedOperations.length; i += MaxOpsPerMessage) {
      const chunk = minifiedOperations.slice(i, i + MaxOpsPerMessage)
      groupedMessages.push({
        messageId: uniqueId(),
        documentId: documentIdRef.current!,
        type: OpsMessageType,
        operations: chunk,
      })
    }

    if (minifiedOperations.length > 0) {
      const opsIndex = unackedOperationsRef.current.indexOf(opsMessages[0])
      unackedOperationsRef.current.splice(opsIndex < 0 ? 0 : opsIndex, 0, ...groupedMessages)
    }

    // We will need to update local changes to remove the operations that were merged into the grouped message and instead add the grouped message
    updateLocalChanges({ removedChanges: opsMessages, addedChanges: groupedMessages })

    // Remove the now acked operations
    unackedOperationsRef.current = unackedOperationsRef.current.filter(
      (opMessage) => !opsMessages.includes(opMessage),
    )

    if (minifiedOperations.length > 0) {
      return [...notOpsMessages, ...groupedMessages]
    }
    return notOpsMessages
  }, [])

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

  // Reset stores on document change
  useEffect(() => {
    conflictsIdsRef.current = []
    unackedOperationsRef.current = []
    localStore.setRoot({
      document: undefined as any,
      fragment: undefined as any,
      fragmentIdToPath: undefined as any,
    })
    remoteStore.setRoot({
      document: undefined as any,
      fragment: undefined as any,
      fragmentIdToPath: undefined as any,
    })
  }, [documentId])

  // On websocket changes
  // Here we handle initial subscriptions, disconnections and re-subscriptions
  useEffect(() => {
    preSyncReceivedOperationsRef.current = []

    if (connectionStatus !== RealtimeConnectionStatus.Open) {
      setSubscriptionSubscriptionStatus(DocumentSubscriptionStatus.Unready)
      subscriptionStatusRef.current = DocumentSubscriptionStatus.Unready

      // If autosave is disabled or editing is not ready, either remote or local, we reset the stores
      if (
        !config.autosave.enabled ||
        (availabilityStatusRef.current !== DocumentAvailabilityStatus.Ready &&
          availabilityStatusRef.current !== DocumentAvailabilityStatus.ReadyLocal)
      ) {
        conflictsIdsRef.current = []
        unackedOperationsRef.current = []
        localStore.setRoot({
          document: undefined as any,
          fragment: undefined as any,
          fragmentIdToPath: undefined as any,
        })
        remoteStore.setRoot({
          document: undefined as any,
          fragment: undefined as any,
          fragmentIdToPath: undefined as any,
        })

        setAvailabilityStatus(DocumentAvailabilityStatus.Unready)
        availabilityStatusRef.current = DocumentAvailabilityStatus.Unready
      } else {
        setAvailabilityStatus(DocumentAvailabilityStatus.ReadyLocal)
        availabilityStatusRef.current = DocumentAvailabilityStatus.ReadyLocal
      }
      return
    }

    setSubscriptionSubscriptionStatus(DocumentSubscriptionStatus.Subscribing)
    subscriptionStatusRef.current = DocumentSubscriptionStatus.Subscribing
    sendMessage({
      messageId: uniqueId(),
      documentId: documentIdRef.current!,
      type: 'subscribe',
    })
  }, [connectionStatus])

  return {
    subscriptionStatus,
    availabilityStatus,
    useStore: localStore.useStore,
    patch,
    subscribe: localStore.subscribe,
  }
}
