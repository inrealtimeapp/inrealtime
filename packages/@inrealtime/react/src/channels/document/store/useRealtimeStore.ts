import { enablePatches, freeze, produceWithPatches } from 'immer'
import { useEffect, useMemo, useRef } from 'react'
import { mountStoreDevtool } from 'simple-zustand-devtools'
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

import {
  DocumentOperationRequest,
  DocumentOperationsRequest,
  DocumentOperationsResponse,
  Fragment,
} from '../../../core'
import { DocumentPatch, Patch, RealtimeStore, UseStore } from './types'
import { resolveConflictsInStore } from './utils/conflictOperationUtils'
import {
  applyPatchOperationsToFragment,
  immerPatchesToOperations,
} from './utils/localOperationUtils'
import { FragmentIdToPath } from './utils/pathUtils'
import { applyRemoteOperationsMessages } from './utils/remoteOperationUtils'

enablePatches()

type useStoreWithPatch<TRealtimeState> = {
  document: TRealtimeState
  fragment: Fragment
  fragmentIdToPath: FragmentIdToPath
  getRoot(): {
    document: TRealtimeState
    fragment: Fragment
    fragmentIdToPath: FragmentIdToPath
  }
  setRoot({}: {
    document: TRealtimeState | undefined
    fragment: Fragment | undefined
    fragmentIdToPath: FragmentIdToPath | undefined
  }): void
  patch: Patch<TRealtimeState>
  applyRemoteOperations(messages: (DocumentOperationsResponse | DocumentOperationsRequest)[]): void
  resolveConflicts(conflictFragmentIds: string[], truthStore: RealtimeStore<TRealtimeState>): void
}

export const useRealtimeStore = <TRealtimeState>({
  onPatchOperations,
  devtools,
}: {
  onPatchOperations?: (requests: DocumentOperationRequest[]) => void
  devtools?: { name: string }
}): RealtimeStore<TRealtimeState> => {
  const onPatchOperationsRef = useRef<(requests: DocumentOperationRequest[]) => void | undefined>()
  useEffect(() => {
    onPatchOperationsRef.current = onPatchOperations
  }, [onPatchOperations])
  const useStoreWithPatchRef = useRef(
    create<useStoreWithPatch<TRealtimeState>>()(
      subscribeWithSelector<useStoreWithPatch<TRealtimeState>>((set, get) => ({
        document: undefined as unknown as TRealtimeState,
        fragment: undefined as any,
        fragmentIdToPath: undefined as any,
        getRoot: () => get(),
        setRoot: ({
          document,
          fragment,
          fragmentIdToPath,
        }: {
          document: TRealtimeState | undefined
          fragment: Fragment | undefined
          fragmentIdToPath: FragmentIdToPath | undefined
        }) => {
          if (document && fragment && fragmentIdToPath) {
            set({
              document: freeze(document),
              fragment: fragment,
              fragmentIdToPath: fragmentIdToPath,
            })
          } else {
            set({ document, fragment, fragmentIdToPath })
          }
        },
        patch: (fn: DocumentPatch<TRealtimeState>) => {
          const oldDocument = get().document
          const oldFragment = get().fragment
          const oldFragmentIdToPath = get().fragmentIdToPath
          const [newDocument, patches, invertPatches] = produceWithPatches(oldDocument, fn)

          const operations = immerPatchesToOperations({
            patches,
            oldDocument,
            newDocument,
          })

          const { newFragment, newFragmentIdToPath, requests } = applyPatchOperationsToFragment({
            fragment: oldFragment,
            fragmentIdToPath: oldFragmentIdToPath,
            operations,
          })

          set({
            document: newDocument,
            fragment: newFragment,
            fragmentIdToPath: newFragmentIdToPath,
          })

          if (onPatchOperationsRef.current) {
            onPatchOperationsRef.current!(requests)
          }
        },
        applyRemoteOperations: (
          messages: (DocumentOperationsResponse | DocumentOperationsRequest)[],
        ) => {
          const oldDocument = get().document
          const oldFragment = get().fragment
          const oldFragmentIdToPath = get().fragmentIdToPath

          const { newDocument, newFragment, newFragmentIdToPath } = applyRemoteOperationsMessages({
            document: oldDocument,
            fragment: oldFragment,
            fragmentIdToPath: oldFragmentIdToPath,
            messages,
          })

          set({
            document: newDocument,
            fragment: newFragment,
            fragmentIdToPath: newFragmentIdToPath,
          })
        },
        resolveConflicts: (
          conflictFragmentIds: string[],
          truthStore: RealtimeStore<TRealtimeState>,
        ) => {
          const oldDocument = get().document
          const oldFragment = get().fragment
          const oldFragmentIdToPath = get().fragmentIdToPath

          const truthStoreRoot = truthStore.getRoot()
          const { newDocument, newFragment, newFragmentIdToPath } = resolveConflictsInStore({
            conflictFragmentIds,
            conflictStore: {
              document: oldDocument,
              fragment: oldFragment,
              fragmentIdToPath: oldFragmentIdToPath,
            },
            truthStore: truthStoreRoot,
          })

          set({
            document: newDocument,
            fragment: newFragment,
            fragmentIdToPath: newFragmentIdToPath,
          })
        },
      })),
    ),
  )

  useEffect(() => {
    if (!devtools) {
      return
    }
    mountStoreDevtool(devtools.name, useStoreWithPatchRef.current)
  }, [])

  // Get getRoot function
  const getRoot = useMemo(() => {
    return () => useStoreWithPatchRef.current.getState().getRoot()
  }, [])

  // Get setRoot function
  const setRoot = useMemo(() => {
    return (props: {
      document: TRealtimeState | undefined
      fragment: Fragment | undefined
      fragmentIdToPath: FragmentIdToPath | undefined
    }) => useStoreWithPatchRef.current.getState().setRoot(props)
  }, [])

  // Create a store hook which only has access to data, i.e. no setter functions
  const useStore: UseStore<TRealtimeState> = useMemo(() => {
    return <TRealtimeSubState>(
      selector?: (state: TRealtimeState) => TRealtimeSubState,
      equalityFn?: ((a: TRealtimeSubState, b: TRealtimeSubState) => boolean) | undefined,
    ) =>
      useStoreWithPatchRef.current(
        (root) =>
          root.fragment === undefined
            ? undefined
            : selector
            ? selector(root.document)
            : (root.document as any),
        equalityFn as any,
      )
  }, [])

  // Create a subscribe function which can subscribe with selector
  const subscribe = useMemo(() => {
    return <TRealtimeSubState>(
      selector: (state: TRealtimeState) => TRealtimeSubState,
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
          root.fragment === undefined
            ? undefined
            : selector
            ? selector(root.document)
            : (root.document as any),
        listener,
        options,
      )
  }, [])

  // Get patch function
  const patch = useMemo(() => {
    return (fn: DocumentPatch<TRealtimeState>) => useStoreWithPatchRef.current.getState().patch(fn)
  }, [])

  // Get applyRemoteOperations function
  const applyRemoteOperations = useMemo(() => {
    return (messages: (DocumentOperationsResponse | DocumentOperationsRequest)[]) =>
      useStoreWithPatchRef.current.getState().applyRemoteOperations(messages)
  }, [])

  // Ge resolveConflicts function
  const resolveConflicts = useMemo(() => {
    return (conflictFragmentIds: string[], truthStore: RealtimeStore<TRealtimeState>) =>
      useStoreWithPatchRef.current.getState().resolveConflicts(conflictFragmentIds, truthStore)
  }, [])

  return {
    getRoot,
    setRoot,
    useStore,
    patch,
    subscribe,
    applyRemoteOperations,
    resolveConflicts,
  }
}
