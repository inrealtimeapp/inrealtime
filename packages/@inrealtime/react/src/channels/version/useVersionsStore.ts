import { useMemo, useRef } from 'react'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import { UseVersions, Versions, VersionsPatch, VersionsStore } from './types'

type useStoreWithPatchType = {
  initial: boolean
  data: Versions
  patch(fn: VersionsPatch): void
  reset(): void
}

export const useVersionsStore = (): VersionsStore => {
  const useStoreWithPatchRef = useRef(
    create<useStoreWithPatchType>()(
      subscribeWithSelector((set, get) => ({
        initial: true,
        data: {},
        patch: (fn: VersionsPatch) => {
          set({
            initial: false,
            data: fn({ versions: get().data }),
          })
        },
        reset: () => {
          if (get().initial) {
            return
          }
          set({
            initial: true,
            data: {},
          })
        },
      })),
    ),
  )

  // Get patch function
  const patch = useMemo(() => {
    return (fn: VersionsPatch) => useStoreWithPatchRef.current.getState().patch(fn)
  }, [])

  // Get reset function
  const reset = useMemo(() => {
    return () => useStoreWithPatchRef.current.getState().reset()
  }, [])

  // Create a store hook which only has access to data, i.e. no setter functions
  const useStore: UseVersions = useMemo(() => {
    return <TRealtimeSubState>(
      selector?: (state: Versions) => TRealtimeSubState,
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
      selector: (me: Versions) => TRealtimeSubState,
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
        (root: any) => {
          return root.data === undefined
            ? undefined
            : selector
            ? selector(root.data)
            : (root.data as any)
        },
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
