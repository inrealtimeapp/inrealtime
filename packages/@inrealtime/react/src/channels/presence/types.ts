import { BroadcastEventResponse, PresenceClient } from '../../core'

export type CollaboratorPatch<TRealtimePresenceData> = ({}: {
  presences: PresenceClient<TRealtimePresenceData>[]
}) => PresenceClient<TRealtimePresenceData>[]

export type PresencePatch<TRealtimePresenceData> = ({}: {
  presence: PresenceClient<TRealtimePresenceData>
}) => PresenceClient<TRealtimePresenceData>

export type UseCollaborators<TRealtimePresenceData> = <TRealtimeSubState>(
  selector?: (collaborators: PresenceClient<TRealtimePresenceData>[]) => TRealtimeSubState,
  equals?: ((a: TRealtimeSubState, b: TRealtimeSubState) => boolean) | undefined,
) => TRealtimeSubState

export type UseMe<TRealtimePresenceData> = <TRealtimeSubState>(
  selector?: (me: PresenceClient<TRealtimePresenceData>) => TRealtimeSubState,
  equals?: ((a: TRealtimeSubState, b: TRealtimeSubState) => boolean) | undefined,
) => TRealtimeSubState

export type PatchMe<TRealtimePresenceData> = (
  data: Partial<TRealtimePresenceData>,
  options?: { replace?: boolean },
) => void

export type SubscribeCollaborators<TRealtimePresenceData> = <TRealtimeSubState>(
  selector: (collaborators: PresenceClient<TRealtimePresenceData>[]) => TRealtimeSubState,
  listener: (selectedState: TRealtimeSubState, previousSelectedState: TRealtimeSubState) => void,
  options?:
    | {
        equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean
        fireImmediately?: boolean
      }
    | undefined,
) => () => void

export type SubscribeMe<TRealtimePresenceData> = <TRealtimeSubState>(
  selector: (me: PresenceClient<TRealtimePresenceData>) => TRealtimeSubState,
  listener: (selectedState: TRealtimeSubState, previousSelectedState: TRealtimeSubState) => void,
  options?:
    | {
        equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean
        fireImmediately?: boolean
      }
    | undefined,
) => () => void

export type CollaboratorStore<TRealtimePresenceData> = {
  useStore: UseCollaborators<TRealtimePresenceData>
  subscribe: SubscribeCollaborators<TRealtimePresenceData>
  patch: (fn: CollaboratorPatch<TRealtimePresenceData>) => void
  reset: () => void
}

export type PresenceStore<TRealtimePresenceData> = {
  useStore: UseMe<TRealtimePresenceData>
  subscribe: SubscribeMe<TRealtimePresenceData>
  patch: (fn: PresencePatch<TRealtimePresenceData>) => void
  reset: () => void
}

export type Broadcast = (
  type: string,
  options: { data?: any; recipientClientIds?: string[] },
) => void
export type UseBroadcastListener = (
  onEvent: (event: BroadcastEventResponse) => void | Promise<void>,
) => void
