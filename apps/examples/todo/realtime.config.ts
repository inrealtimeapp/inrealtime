import { createRealtimeContext, createRealtimeGroupContext } from '@inrealtime/react'

export interface TodoItem {
  id: string
  label: string
  isCompleted: boolean
}

export type RealtimeDocument = {
  todos: TodoItem[]
}

export type PresenceData = {
  id: string
  emoji?: string
  cursor?: { x?: number; y?: number }
}

// export const {
//   RealtimeProvider,
//   useRealtimeContext,
//   usePresenceStatus,
//   useConnectionStatus,
//   useDocumentStatus,
//   useStore,
//   usePatch,
//   useSubscribe,
//   useCollaborators,
//   useSubscribeCollaborators,
//   useMe,
//   usePatchMe,
//   useSubscribeMe,
//   useBroadcast,
//   useBroadcastListener,
// } = createRealtimeContext<RealtimeDocument, PresenceData>()

export const {
  RealtimeGroupProvider,
  RealtimeDocumentProvider,
  useRealtimeGroupContext,
  useRealtimeDocumentContext,
  usePresenceStatus,
  useConnectionStatus,
  useDocumentStatus,
  useStore,
  usePatch,
  useSubscribe,
  useCollaborators,
  useSubscribeCollaborators,
  useMe,
  usePatchMe,
  useSubscribeMe,
  useBroadcast,
  useBroadcastListener,
} = createRealtimeGroupContext<RealtimeDocument, PresenceData>()
