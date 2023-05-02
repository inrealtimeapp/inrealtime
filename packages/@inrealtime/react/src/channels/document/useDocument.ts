import { MutableRefObject, useCallback, useEffect, useRef, useState } from 'react'

import { RealtimeConfig } from '../../config'
import {
  DocumentOperationAckResponse,
  DocumentOperationRequest,
  DocumentOperationsRequest,
  DocumentOperationsResponse,
  Fragment,
  FragmentType,
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
  connectionStatusRef,
  useChannel,
  documentId,
  throttle: requestedThrottle,
}: {
  config: RealtimeConfig
  connectionStatus: RealtimeConnectionStatus
  connectionStatusRef: MutableRefObject<RealtimeConnectionStatus>
  useChannel: UseChannel
  documentId?: string
  throttle: number
}) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState<DocumentSubscriptionStatus>(
    DocumentSubscriptionStatus.Unready,
  )
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

  // The subscription id and document id we are currently subscribed to
  const subscriptionIdRef = useRef<string>()
  const subscribedToDocumentIdRef = useRef<string>()

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
    if (requests.length === 0) {
      return
    }

    const request: DocumentOperationsRequest = {
      messageId: uniqueId(),
      subId: subscriptionIdRef.current!,
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
    subscriptionIdRef,
    localStore,
    onLocalData: useCallback((fragment) => {
      if (availabilityStatusRef.current === DocumentAvailabilityStatus.Ready) {
        return
      }
      if (fragment.type !== FragmentType.List && fragment.type !== FragmentType.Map) {
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

    setSubscriptionStatus(DocumentSubscriptionStatus.Ready)
    subscriptionStatusRef.current = DocumentSubscriptionStatus.Ready
    setAvailabilityStatus(DocumentAvailabilityStatus.Ready)
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
      if (message.docId !== documentIdRef.current) {
        return
      }

      switch (message.type) {
        case 'sync':
          {
            // Make sure that the sync message is for the current subscription
            if (subscriptionIdRef.current !== message.subId) {
              return
            }

            onSyncMessage(message.document)
          }
          break
        case 'ack':
          {
            const ackMessage = message as DocumentOperationAckResponse

            // Make sure that the ack message is for the current subscription
            if (subscriptionIdRef.current !== ackMessage.subId) {
              return
            }

            onAckMessage(ackMessage)
          }
          break
        case 'ops':
          {
            const documentOpsMessage = message as DocumentOperationsResponse

            // If we have more than 1 subscription to the same document we need to ignore messages that the current subscription sent
            if (subscriptionIdRef.current === documentOpsMessage.clientSubId) {
              return
            }

            onOpsMessage(documentOpsMessage)
          }
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

    const groupedMessages: DocumentOperationsRequest[] = []
    const opsMessagesBySubIdMap = groupBy(opsMessages, (m) => m.subId)
    opsMessagesBySubIdMap.forEach((opsMessagesBySubId, subId) => {
      // Flattened list of operations
      const operations = ([] as DocumentOperationRequest[]).concat(
        ...opsMessagesBySubId.map((m) => m.operations),
      )

      // Minified operations
      const minifiedOperations = minifyOperations(operations) as DocumentOperationRequest[]
      if (minifiedOperations.length === 0) {
        return
      }

      // Create grouped messages based on chunk size
      for (let i = 0; i < minifiedOperations.length; i += MaxOpsPerMessage) {
        const chunk = minifiedOperations.slice(i, i + MaxOpsPerMessage)
        groupedMessages.push({
          messageId: uniqueId(),
          type: OpsMessageType,
          subId,
          operations: chunk,
        })
      }
    })

    // Insert the grouped messages into the unacked operations list
    // We insert them at the first opsMessages index so that they are acked in the correct order
    if (groupedMessages.length > 0) {
      const opsIndex = unackedOperationsRef.current.indexOf(opsMessages[0])
      unackedOperationsRef.current.splice(opsIndex < 0 ? 0 : opsIndex, 0, ...groupedMessages)
    }

    // We will need to update local changes to remove the operations that were merged into the grouped message and instead add the grouped message
    updateLocalChanges({ removedChanges: opsMessages, addedChanges: groupedMessages })

    // Remove the now acked operations
    unackedOperationsRef.current = unackedOperationsRef.current.filter(
      (opMessage) => !opsMessages.includes(opMessage),
    )

    if (groupedMessages.length > 0) {
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

  // Check whether the document is offline capable
  const isOfflineCapable = useCallback(() => {
    return (
      config.autosave.enabled &&
      (availabilityStatusRef.current === DocumentAvailabilityStatus.Ready ||
        availabilityStatusRef.current === DocumentAvailabilityStatus.ReadyLocal)
    )
  }, [])

  // Make stores unavailable
  const resetStoresToUnavailable = useCallback(() => {
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

    subscriptionIdRef.current = undefined as any
    subscribedToDocumentIdRef.current = undefined as any
  }, [])

  // Make stores locally available
  const setStoreLocallyAvailable = useCallback(() => {
    setAvailabilityStatus(DocumentAvailabilityStatus.ReadyLocal)
    availabilityStatusRef.current = DocumentAvailabilityStatus.ReadyLocal
  }, [])

  // Subscribe do a document
  const subscribe = useCallback((docId: string) => {
    subscriptionIdRef.current = uniqueId(5)
    subscribedToDocumentIdRef.current = docId
    sendMessage({
      messageId: uniqueId(),
      type: 'subscribe',
      docId: subscribedToDocumentIdRef.current!,
      subId: subscriptionIdRef.current!,
    })
  }, [])

  // On websocket changes
  // Here we handle initial subscriptions and websocket disconnections
  useEffect(() => {
    if (connectionStatus !== RealtimeConnectionStatus.Open) {
      setSubscriptionStatus(DocumentSubscriptionStatus.Unready)
      subscriptionStatusRef.current = DocumentSubscriptionStatus.Unready

      if (!isOfflineCapable()) {
        resetStoresToUnavailable()
      } else {
        setStoreLocallyAvailable()
      }

      return
    }

    setSubscriptionStatus(DocumentSubscriptionStatus.Subscribing)
    subscriptionStatusRef.current = DocumentSubscriptionStatus.Subscribing
    return () => {
      // If connection changes we automatically unsubscribe
      subscriptionIdRef.current = undefined as any
      subscribedToDocumentIdRef.current = undefined as any
    }
  }, [connectionStatus])

  // Reset stores on document change. Also, possibly re-subscriptions
  useEffect(() => {
    documentIdRef.current = documentId

    // Unsubscribe from previous document
    if (
      subscriptionIdRef.current &&
      connectionStatusRef.current === RealtimeConnectionStatus.Open
    ) {
      sendMessage({
        messageId: uniqueId(),
        type: 'unsubscribe',
        subId: subscriptionIdRef.current,
      })
    }

    resetStoresToUnavailable()

    if (!documentId || connectionStatusRef.current !== RealtimeConnectionStatus.Open) {
      setSubscriptionStatus(DocumentSubscriptionStatus.Unready)
      subscriptionStatusRef.current = DocumentSubscriptionStatus.Unready
      return
    }

    // Change document to subscribe to
    if (subscriptionStatusRef.current === DocumentSubscriptionStatus.Subscribing) {
      subscribe(documentId)
    }

    setSubscriptionStatus(DocumentSubscriptionStatus.Subscribing)
    subscriptionStatusRef.current = DocumentSubscriptionStatus.Subscribing
  }, [documentId])

  // Subscribe to document
  useEffect(() => {
    if (
      subscriptionStatus !== DocumentSubscriptionStatus.Subscribing ||
      subscriptionIdRef.current !== undefined
    ) {
      return
    }

    subscribe(documentIdRef.current!)
  }, [subscriptionStatus])

  return {
    subscriptionStatus,
    availabilityStatus,
    useStore: localStore.useStore,
    patch,
    subscribe: localStore.subscribe,
  }
}

const groupBy = <T>(list: T[], keyGetter: (d: T) => any): Map<string, T[]> => {
  const map = new Map<string, T>()
  list.forEach((item) => {
    const key = keyGetter(item)
    const collection = map.get(key)
    if (!collection) {
      map.set(key, [item])
    } else {
      collection.push(item)
    }
  })
  return map
}
