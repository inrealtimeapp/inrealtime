import { createRealtimeDocumentContext, createRealtimeGroupContext } from '@inrealtime/react'

export interface TodoItem {
  id: string
  label: string
  isCompleted: boolean
}

export type RealtimeDocument = {
  documentId: string
  todos: TodoItem[]
}

export type PresenceData = {
  id: string
  emoji?: string
}

export const {
  RealtimeGroupProvider,
  useRealtimeGroupContext,
  useConnectionStatus,
  usePresenceStatus,
  useCollaborators,
  useSubscribeCollaborators,
  useMe,
  usePatchMe,
  useSubscribeMe,
  useBroadcast,
  useBroadcastListener,
  useDuplicate,
} = createRealtimeGroupContext<PresenceData>()

export const {
  RealtimeDocumentProvider: RealtimeDocumentProvider,
  useRealtimeDocumentContext: useRealtimeDocumentContext,
  useDocumentStatus: useDocumentStatus,
  useStore: useDocumentStore,
  usePatch: useDocumentPatch,
  useSubscribe: useDocumentSubscribe,
} = createRealtimeDocumentContext<RealtimeDocument>({ useRealtimeGroupContext })

export type RealtimeDocumentInDirectory = {
  documentId: string
  parentId?: string
  title: string
}

export type RealtimeDirectory = {
  documents: {
    [slateId: string]: RealtimeDocumentInDirectory
  }
}

export const {
  RealtimeDocumentProvider: RealtimeDirectoryProvider,
  useRealtimeDocumentContext: useRealtimeDirectoryContext,
  useDocumentStatus: useDirectoryStatus,
  useStore: useDirectoryStore,
  usePatch: useDirectoryPatch,
  useSubscribe: useDirectorySubscribe,
} = createRealtimeDocumentContext<RealtimeDirectory>({ useRealtimeGroupContext })
