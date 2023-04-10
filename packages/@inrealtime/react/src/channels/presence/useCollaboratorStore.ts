import { useMemo } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import { PresenceClient } from '../../core'
import { CollaboratorPatch, CollaboratorStore } from './types'

export const useCollaboratorStore = <
  TRealtimePresenceData,
>(): CollaboratorStore<TRealtimePresenceData> => {
  const useStoreWithPatch = useMemo(
    () =>
      create(
        subscribeWithSelector<{
          initial: boolean
          data: PresenceClient<TRealtimePresenceData>[]
          patch(fn: CollaboratorPatch<TRealtimePresenceData>): void
          reset(): void
        }>((set, get) => ({
          initial: true,
          data: [],
          patch: (fn: CollaboratorPatch<TRealtimePresenceData>) => {
            set({
              data: [...fn({ presences: get().data })], // Create new list for selector
            })
          },
          reset: () => {
            if (get().initial) {
              return
            }
            set({
              initial: true,
              data: [],
            })
          },
        })),
      ),
    [],
  )
  // Get patch function
  const patch = useStoreWithPatch((root) => root.patch)

  // Get reset function
  const reset = useStoreWithPatch((root) => root.reset)

  // Create a store hook which only has access to data, i.e. no setter functions
  const useStore = useMemo(() => {
    return <TRealtimeSubState>(
      selector?: (collaborators: PresenceClient<TRealtimePresenceData>[]) => TRealtimeSubState,
      equals?: ((a: TRealtimeSubState, b: TRealtimeSubState) => boolean) | undefined,
    ) =>
      useStoreWithPatch(
        (root) =>
          root.data === undefined ? undefined : selector ? selector(root.data) : (root.data as any),
        equals,
      )
  }, [useStoreWithPatch])

  // Create a subscribe function which can subscribe with selector
  const subscribe = useMemo(() => {
    return <TRealtimeSubState>(
      selector: (collaborators: PresenceClient<TRealtimePresenceData>[]) => TRealtimeSubState,
      listener: (
        selectedState: TRealtimeSubState,
        previousSelectedState: TRealtimeSubState,
      ) => void,
      options?: {
        equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean
        fireImmediately?: boolean
      },
    ) =>
      useStoreWithPatch.subscribe(
        (root) =>
          root.data === undefined ? undefined : selector ? selector(root.data) : (root.data as any),
        listener,
        options,
      )
  }, [useStoreWithPatch])

  return {
    useStore,
    patch,
    subscribe,
    reset,
  }
}
