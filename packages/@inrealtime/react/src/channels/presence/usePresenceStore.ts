import { useMemo, useRef } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import { PresenceClient } from '../../core'
import { PresencePatch, PresenceStore, UseMe } from './types'

type useStoreWithPatchType<TRealtimePresenceData> = {
  initial: boolean
  data: PresenceClient<TRealtimePresenceData>
  patch(fn: PresencePatch<TRealtimePresenceData>): void
  reset(): void
}

export const usePresenceStore = <TRealtimePresenceData>(): PresenceStore<TRealtimePresenceData> => {
  const useStoreWithPatchRef = useRef(
    create<useStoreWithPatchType<TRealtimePresenceData>>()(
      subscribeWithSelector((set, get) => ({
        initial: true,
        data: {
          data: {},
        } as PresenceClient<TRealtimePresenceData>,
        patch: (fn: PresencePatch<TRealtimePresenceData>) => {
          set({
            initial: false,
            data: fn({ presence: get().data }),
          })
        },
        reset: () => {
          if (get().initial) {
            return
          }
          set({
            initial: true,
            data: { data: {} } as PresenceClient<TRealtimePresenceData>,
          })
        },
      })),
    ),
  )

  // Get patch function
  const patch = useMemo(() => {
    return (fn: PresencePatch<TRealtimePresenceData>) =>
      useStoreWithPatchRef.current.getState().patch(fn)
  }, [])

  // Get reset function
  const reset = useMemo(() => {
    return () => useStoreWithPatchRef.current.getState().reset()
  }, [])

  // Create a store hook which only has access to data, i.e. no setter functions
  const useStore: UseMe<TRealtimePresenceData> = useMemo(() => {
    return <TRealtimeSubState>(
      selector?: (state: PresenceClient<TRealtimePresenceData>) => TRealtimeSubState,
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
      selector: (me: PresenceClient<TRealtimePresenceData>) => TRealtimeSubState,
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
        (root) =>
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
