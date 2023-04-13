import React, { useMemo } from 'react'

import { Patch, Subscribe, UseStore } from './channels/document/store/types'
import {
  Broadcast,
  PatchMe,
  SubscribeCollaborators,
  SubscribeMe,
  UseBroadcastListener,
  UseCollaborators,
  UseMe,
} from './channels/presence/types'
import { GetAuthToken, PresenceClient } from './core'
import { RealtimeStatus, useRealtime } from './useRealtime'

type RealtimeContextProps<TRealtimeState, TRealtimePresenceData> = {
  status: RealtimeStatus
  useStore: UseStore<TRealtimeState>
  patch: Patch<TRealtimeState>
  subscribe: Subscribe<TRealtimeState>
  useCollaborators: UseCollaborators<TRealtimePresenceData>
  subscribeCollaborators: SubscribeCollaborators<TRealtimePresenceData>
  useMe: UseMe<TRealtimePresenceData>
  patchMe: PatchMe<TRealtimePresenceData>
  subscribeMe: SubscribeMe<TRealtimePresenceData>
  broadcast: Broadcast
  useBroadcastListener: UseBroadcastListener
}

type RealtimeProviderProps = {
  children: React.ReactNode
  documentId?: string
  throttle?: number
  getAuthToken?: GetAuthToken
  publicAuthKey?: string
  developerSettings?: {
    devtools?: boolean
  }
  _package?: {
    environment?: 'local' | 'development' | 'production'
    debug?: {
      conflicts?: boolean
    }
  }
}

type RealtimeContextCollection<TRealtimeState, TRealtimePresenceData> = {
  RealtimeProvider(props: RealtimeProviderProps): JSX.Element
  useRealtimeContext(): RealtimeContextProps<TRealtimeState, TRealtimePresenceData>
  useStatus(): RealtimeStatus
  useStore: UseStore<TRealtimeState>
  usePatch(): Patch<TRealtimeState>
  useSubscribe(): Subscribe<TRealtimeState>
  useCollaborators: UseCollaborators<TRealtimePresenceData>
  useSubscribeCollaborators(): SubscribeCollaborators<TRealtimePresenceData>
  useMe: UseMe<TRealtimePresenceData>
  usePatchMe(): PatchMe<TRealtimePresenceData>
  useSubscribeMe(): SubscribeMe<TRealtimePresenceData>
  useBroadcast(): Broadcast
  useBroadcastListener: UseBroadcastListener
}

export const createRealtimeContext = <
  TRealtimeState,
  TRealtimePresenceData,
>(): RealtimeContextCollection<TRealtimeState, TRealtimePresenceData> => {
  const RealtimeContext = React.createContext<Partial<
    RealtimeContextProps<TRealtimeState, TRealtimePresenceData>
  > | null>(null)

  const RealtimeProvider = ({
    children,
    documentId,
    throttle,
    getAuthToken,
    publicAuthKey,
    developerSettings,
    _package,
  }: RealtimeProviderProps) => {
    const {
      status,
      useStore,
      patch,
      subscribe,
      useCollaborators,
      subscribeCollaborators,
      useMe,
      patchMe,
      subscribeMe,
      broadcast,
      useBroadcastListener,
    } = useRealtime<TRealtimeState, TRealtimePresenceData>({
      documentId,
      getAuthToken,
      publicAuthKey,
      throttle,
      developerSettings,
      _package,
    })

    return (
      <RealtimeContext.Provider
        value={{
          status,
          useStore,
          patch,
          subscribe,
          useCollaborators,
          subscribeCollaborators,
          useMe,
          patchMe,
          subscribeMe,
          broadcast,
          useBroadcastListener,
        }}
      >
        {children}
      </RealtimeContext.Provider>
    )
  }

  const useRealtimeContext = () => {
    return React.useContext(RealtimeContext) as RealtimeContextProps<
      TRealtimeState,
      TRealtimePresenceData
    >
  }

  const useStatus = () => {
    const { status } = useRealtimeContext()

    if (status === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return status
  }

  const useStore = (
    selector?: (root: TRealtimeState) => any,
    equalityFn?: ((a: any, b: any) => boolean) | undefined,
  ) => {
    const { useStore } = useRealtimeContext()

    if (useStore === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return selector ? useStore(selector, equalityFn) : useStore()
  }

  const usePatch = (): Patch<TRealtimeState> => {
    const { patch } = useRealtimeContext()

    if (patch === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return patch
  }

  const useSubscribe = (): Subscribe<TRealtimeState> => {
    const { subscribe } = useRealtimeContext()

    if (subscribe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribe
  }

  function useCollaborators(
    selector: (root: PresenceClient<TRealtimePresenceData>[]) => any,
    equalityFn: (a: any, b: any) => boolean,
  ) {
    const { useCollaborators } = useRealtimeContext()

    if (useCollaborators === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return useCollaborators(selector, equalityFn)
  }

  const useSubscribeCollaborators = (): SubscribeCollaborators<TRealtimePresenceData> => {
    const { subscribeCollaborators } = useRealtimeContext()

    if (subscribeCollaborators === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribeCollaborators
  }

  function useMe(
    selector: (root: PresenceClient<TRealtimePresenceData>) => any,
    equalityFn: (a: any, b: any) => boolean,
  ) {
    const { useMe } = useRealtimeContext()

    if (useMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return useMe(selector, equalityFn)
  }

  const usePatchMe = (): PatchMe<TRealtimePresenceData> => {
    const { patchMe } = useRealtimeContext()

    if (patchMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return patchMe
  }

  const useSubscribeMe = (): SubscribeMe<TRealtimePresenceData> => {
    const { subscribeMe } = useRealtimeContext()

    if (subscribeMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribeMe
  }

  const useBroadcast = (): Broadcast => {
    const { broadcast } = useRealtimeContext()

    if (broadcast === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return broadcast
  }

  const useBroadcastListener: UseBroadcastListener = (onEvent) => {
    const { useBroadcastListener } = useRealtimeContext()

    if (useBroadcastListener === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return useBroadcastListener(onEvent)
  }

  return {
    RealtimeProvider,
    useRealtimeContext,
    useStatus,
    useStore,
    usePatch,
    useSubscribe,
    useCollaborators: useCollaborators as UseCollaborators<TRealtimePresenceData>,
    useSubscribeCollaborators,
    useMe: useMe as UseMe<TRealtimePresenceData>,
    usePatchMe,
    useSubscribeMe,
    useBroadcast,
    useBroadcastListener,
  }
}
