import { useCallback, useEffect, useRef, useState } from 'react'

import { RealtimeConfig } from '../../config'
import {
  DocumentOperationAckResponse,
  DocumentOperationRequest,
  DocumentOperationsRequest,
  DocumentOperationsResponse,
  Fragment,
  RealtimeMessage,
  uniqueId,
} from '../../core'
import { RealtimeWebSocketStatus } from '../../socket/types'
import { UseChannel } from '../../socket/useWebSocket'
import { IAutosave } from './store/autosave/autosave'
import { IndexedAutosave } from './store/autosave/indexeddb_autosave'
import { areStoresEqual } from './store/tests/storeEqual'
import { DocumentPatch } from './store/types'
import { useRealtimeStore } from './store/useRealtimeStore'
import { fragmentToDocument } from './store/utils/fragmentUtils'
import { minifyOperations } from './store/utils/minifyOperations'
import { createFragmentIdToPath } from './store/utils/pathUtils'
import { applyRemoteOperationsToStores } from './store/utils/remoteOperationUtils'

const OpsMessageType = 'ops'

export enum DocumentStatus {
  Unready = 'Unready',
  Subscribing = 'Subscribing',
  Ready = 'Ready',
}

export enum DocumentEditStatus {
  Unready = 'Unready',
  ReadyLocal = 'ReadyLocal',
  Ready = 'Ready',
}

export const useDocumentChannel = <TRealtimeState>({
  config,
  webSocketStatus,
  useChannel,
  documentId,
  throttle: requestedThrottle,
}: {
  config: RealtimeConfig
  webSocketStatus: RealtimeWebSocketStatus
  useChannel: UseChannel
  documentId?: string
  throttle: number
}) => {
  const [status, setStatus] = useState<DocumentStatus>(DocumentStatus.Unready)
  const statusRef = useRef<DocumentStatus>(DocumentStatus.Unready)
  const [editStatus, setEditStatus] = useState<DocumentEditStatus>(DocumentEditStatus.Unready)
  const editStatusRef = useRef<DocumentEditStatus>(DocumentEditStatus.Unready)
  const [throttle, setThrottle] = useState<number>(0)
  const sendMessageRef = useRef<(message: RealtimeMessage) => void>()

  // Operations that were received between subscribe and sync
  const preSyncReceivedOperationsRef = useRef<DocumentOperationsResponse[]>([])

  // All possible fragment ids that will need to be resolved
  const conflictsIdsRef = useRef<string[]>([])

  // All operations that have been unacked
  const unackedOperationsRef = useRef<DocumentOperationsRequest[]>([])

  // Local stored fragment and changes
  const autosaveDatabaseRef = useRef<IAutosave>()
  const [localFragment, setLocalFragment] = useState<Fragment>()
  const localChangesRef = useRef<DocumentOperationsRequest[]>([])
  const unremovedLocalChangesRef = useRef<DocumentOperationsRequest[]>([])
  const unsavedLocalChangesRef = useRef<DocumentOperationsRequest[]>([])
  const unsavedChangesRef = useRef<boolean>(false)

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
      (editStatusRef.current !== DocumentEditStatus.Ready &&
        editStatusRef.current !== DocumentEditStatus.ReadyLocal) ||
      requests.length === 0
    ) {
      return
    }

    const request: DocumentOperationsRequest = {
      messageId: uniqueId(),
      type: OpsMessageType,
      operations: requests,
    }

    if (config.autosave) {
      localChangesRef.current.push(request)
      unsavedLocalChangesRef.current.push(request)
      unsavedChangesRef.current = true
    }

    if (statusRef.current !== DocumentStatus.Ready) {
      return
    }

    sendOperations(request)
  }, [])

  // Create stores
  const localStore = useRealtimeStore<TRealtimeState>({
    onPatchOperations: onLocalPatchOperations,
  })
  const remoteStore = useRealtimeStore<TRealtimeState>({})

  // Reset a specific store
  const resetStore = useCallback((store: 'local' | 'remote') => {
    if (store === 'local') {
      localStore.setRoot({
        document: undefined as any,
        fragment: undefined as any,
        fragmentIdToPath: undefined as any,
      })
    } else if (store === 'remote') {
      remoteStore.setRoot({
        document: undefined as any,
        fragment: undefined as any,
        fragmentIdToPath: undefined as any,
      })
    }
  }, [])

  // Update throttle to the requested throttle
  // We want to begin with throttle 0 to get subscribe message out as soon as possible, but change to the requested throttle afterwards
  useEffect(() => {
    if (status !== DocumentStatus.Ready) {
      setThrottle(0)
      return
    }

    setThrottle(requestedThrottle)
  }, [status, requestedThrottle])

  // Load from local store
  useEffect(() => {
    if (!documentId || !config.autosave) {
      setLocalFragment(undefined as any)
      return
    }

    const autosaveDatabase = new IndexedAutosave()
    autosaveDatabaseRef.current = autosaveDatabase

    autosaveDatabase.init(documentId).then(async () => {
      const fragmentPromise = autosaveDatabase.getFragment({ documentId })
      const localChangesPromise = autosaveDatabase.getOperations({ documentId })
      const fragment = await fragmentPromise
      const localChanges = await localChangesPromise

      if (fragment && localChanges) {
        setLocalFragment(fragment)
        localChangesRef.current = localChanges
      }
    })
  }, [documentId])

  // Set local store on local fragment
  useEffect(() => {
    if (!localFragment) {
      return
    }

    if (statusRef.current === DocumentStatus.Ready) {
      return
    }

    const document = fragmentToDocument({ fragment: localFragment })
    const fragmentIdToPath = createFragmentIdToPath({ fragment: localFragment })
    localStore.setRoot({
      document,
      fragment: localFragment,
      fragmentIdToPath: { ...fragmentIdToPath },
    })
    conflictsIdsRef.current = []
    unackedOperationsRef.current = []

    setEditStatus(DocumentEditStatus.ReadyLocal)
    editStatusRef.current = DocumentEditStatus.ReadyLocal
  }, [localFragment])

  // Autosave fragment and changes
  useEffect(() => {
    const autosaveDatabase = autosaveDatabaseRef.current

    if (!autosaveDatabase || !documentId) {
      return
    }

    const timer = setInterval(async () => {
      if (!unsavedChangesRef.current) {
        return
      }

      unsavedChangesRef.current = false

      // Save fragment
      const promises: Promise<any>[] = [
        autosaveDatabase.saveFragment({
          documentId,
          fragment: localStore.getRoot().fragment,
        }),
      ]

      // Save local changes
      for (const request of unsavedLocalChangesRef.current) {
        promises.push(autosaveDatabase.saveOperation({ documentId, message: request }))
      }
      localChangesRef.current.push(...unsavedLocalChangesRef.current)
      unsavedLocalChangesRef.current = []

      // Remove local changes
      for (const request of unremovedLocalChangesRef.current) {
        promises.push(
          autosaveDatabase.removeOperation({ documentId, messageId: request.messageId }),
        )
      }
      localChangesRef.current = localChangesRef.current.filter(
        (request) => !unremovedLocalChangesRef.current.includes(request),
      )
      unremovedLocalChangesRef.current = []

      for (const promise of promises) {
        try {
          await promise
        } catch (error) {
          console.error(error)
        }
      }
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [documentId])

  // On sync message
  const onSyncMessage = useCallback((fragment: Fragment) => {
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
    if (config.autosave && localChangesRef.current.length > 0) {
      applyRemoteOperationsToStores(localChangesRef.current, [localStore])
      for (const request of localChangesRef.current) {
        sendOperations(request)
      }
      localChangesRef.current = []
      unsavedChangesRef.current = true
    }

    setStatus(DocumentStatus.Ready)
    setEditStatus(DocumentEditStatus.Ready)
    statusRef.current = DocumentStatus.Ready
    editStatusRef.current = DocumentEditStatus.Ready
  }, [])

  // On ack message
  const onAckMessage = useCallback((ack: DocumentOperationAckResponse) => {
    if (statusRef.current !== DocumentStatus.Ready) {
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

    if (config.autosave) {
      unsavedChangesRef.current = true

      // If the local changed hasn't been saved we can just remove it
      // Otherwise we need to remove the operation from the saved local change
      const unsavedLocalChange = unsavedLocalChangesRef.current.find(
        (r) => r.messageId === ack.ackMessageId,
      )!
      if (unsavedLocalChange) {
        unsavedLocalChangesRef.current.splice(
          unsavedLocalChangesRef.current.indexOf(unsavedLocalChange),
          1,
        )
      } else {
        const localChange = localChangesRef.current.find((r) => r.messageId === ack.ackMessageId)!
        if (localChange) {
          unremovedLocalChangesRef.current.push(localChange)
        } else {
          console.warn("Couldn't find local change for acked operation")
        }
      }
    }

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

        if (!storesEqual) {
          console.warn(
            'Conflicts not resolved. Remote and local are NOT equal!',
            'Previous request -> ',
            request,
          )
        } else {
          console.log('Conflicts resolved, remote and local are equal.')
        }
      }
    }
  }, [])

  // On operations message
  const onOpsMessage = useCallback((message: DocumentOperationsResponse) => {
    // All operations that were received in between subscribe and sync are applied when sync completes
    if (statusRef.current === DocumentStatus.Subscribing) {
      preSyncReceivedOperationsRef.current.push(message)
      return
    }

    if (statusRef.current !== DocumentStatus.Ready) {
      return
    }

    applyRemoteOperationsToStores([message], [localStore, remoteStore])
    unsavedChangesRef.current = true
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
        editStatusRef.current !== DocumentEditStatus.Ready &&
        editStatusRef.current !== DocumentEditStatus.ReadyLocal
      ) {
        console.warn(`Cannot patch document when document edit status is ${editStatusRef.current}.`)
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

    // We will need to update local changes to remove the operations that were merged into the grouped message and instead add the grouped message
    if (config.autosave) {
      // We will need to remove all operations from unsaved local changes
      unsavedLocalChangesRef.current = unsavedLocalChangesRef.current.filter(
        (opMessage) => !opsMessages.includes(opMessage),
      )

      // We will need to add all operations in localChanges to unremovedLocalChanges
      const localChangesToRemove = localChangesRef.current.filter((opMessage) =>
        opsMessages.includes(opMessage),
      )
      unremovedLocalChangesRef.current.push(...localChangesToRemove)

      // We will need to add the new grouped message to unsavedLocalChanges
      unsavedLocalChangesRef.current.push(groupedMessage)
    }

    unackedOperationsRef.current = unackedOperationsRef.current.filter(
      (opMessage) => !opsMessages.includes(opMessage),
    )

    if (minifiedOperations.length > 0) {
      return [...notOpsMessages, groupedMessage]
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

  // On websocket changes
  // Here we handle initial subscriptions, disconnections and re-subscriptions
  useEffect(() => {
    preSyncReceivedOperationsRef.current = []

    if (webSocketStatus !== RealtimeWebSocketStatus.Open) {
      setStatus(DocumentStatus.Unready)
      statusRef.current = DocumentStatus.Unready

      if (!config.autosave) {
        conflictsIdsRef.current = []
        unackedOperationsRef.current = []
        resetStore('local')
        resetStore('remote')

        setEditStatus(DocumentEditStatus.Unready)
        editStatusRef.current = DocumentEditStatus.Unready
      } else {
        setEditStatus(DocumentEditStatus.ReadyLocal)
        editStatusRef.current = DocumentEditStatus.ReadyLocal
      }
      return
    }

    setStatus(DocumentStatus.Subscribing)
    statusRef.current = DocumentStatus.Subscribing
    sendMessage({ messageId: uniqueId(), type: 'subscribe' })
  }, [webSocketStatus])

  return {
    status,
    editStatus,
    useStore: localStore.useStore,
    patch,
    subscribe: localStore.subscribe,
  }
}
