import { useMemo, useRef } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import { PresenceClient } from '../../core'
import { CollaboratorPatch, CollaboratorStore, UseCollaborators } from './types'

type useStoreWithPatchType<TRealtimePresenceData> = {
  initial: boolean
  data: PresenceClient<TRealtimePresenceData>[]
  patch(fn: CollaboratorPatch<TRealtimePresenceData>): void
  reset(): void
}

export const useCollaboratorStore = <
  TRealtimePresenceData,
>(): CollaboratorStore<TRealtimePresenceData> => {
  const useStoreWithPatchRef = useRef(
    create<useStoreWithPatchType<TRealtimePresenceData>>()(
      subscribeWithSelector((set, get) => ({
        initial: true,
        data: [],
        patch: (fn: CollaboratorPatch<TRealtimePresenceData>) => {
          set({
            initial: false,
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
  )

  // Get patch function
  const patch = useMemo(() => {
    return (fn: CollaboratorPatch<TRealtimePresenceData>) =>
      useStoreWithPatchRef.current.getState().patch(fn)
  }, [])

  // Get reset function
  const reset = useMemo(() => {
    return () => useStoreWithPatchRef.current.getState().reset()
  }, [])

  // Create a store hook which only has access to data, i.e. no setter functions
  const useStore: UseCollaborators<TRealtimePresenceData> = useMemo(() => {
    return <TRealtimeSubState>(
      selector?: (collaborators: PresenceClient<TRealtimePresenceData>[]) => TRealtimeSubState,
      equalityFn?: ((a: TRealtimeSubState, b: TRealtimeSubState) => boolean) | undefined,
    ) =>
      useStoreWithPatchRef.current(
        (root) =>
          root.data === undefined ? undefined : selector ? selector(root.data) : (root.data as any),
        equalityFn as any,
      )
  }, [])

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
      (useStoreWithPatchRef.current.subscribe as any)(
        (root: any) =>
          root.data === undefined ? undefined : selector ? selector(root.data) : (root.data as any),
        listener,
        options,
      )
  }, [])

  return {
    useStore,
    patch,
    subscribe,
    reset,
  }
}
