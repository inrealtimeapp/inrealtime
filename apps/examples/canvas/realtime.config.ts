import { createRealtimeContext } from '@inrealtime/react'

export type RealtimeDocument = {
  boxes: { [id: string]: { x: number; y: number; color: string; active: boolean } }
}

export type PresenceData = {
  id: string
  emoji?: string
  cursor?: { x?: number; y?: number }
  cursorActive?: boolean
}

export const {
  RealtimeProvider,
  useRealtimeContext,
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
} = createRealtimeContext<RealtimeDocument, PresenceData>()
