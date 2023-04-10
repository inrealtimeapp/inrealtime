import { createRealtimeContext } from '@inrealtime/react'

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
  name?: string
  cursor?: { x?: number; y?: number }
}

export const {
  RealtimeProvider,
  useRealtimeContext,
  useStatus,
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
} = createRealtimeContext<RealtimeDocument, PresenceData>()
