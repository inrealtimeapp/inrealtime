import React from 'react'

import { Broadcast, UseBroadcastListener } from './channels/broadcast/types'
import { Patch, Subscribe, UseStore } from './channels/document/store/types'
import {
  PatchMe,
  SubscribeCollaborators,
  SubscribeMe,
  UseCollaborators,
  UseMe,
} from './channels/presence/types'
import { RealtimePresenceStatus } from './channels/presence/usePresence'
import { PresenceClient } from './core'
import { RealtimeConnectionStatus } from './socket/types'
import { RealtimeSingleConnectionOptions } from './types'
import { useRealtime } from './useRealtime'
import { RealtimeDocumentStatus } from './useRealtimeDocument'

export type RealtimeContextProps<TRealtimeState, TRealtimePresenceData> = {
  connectionStatus: RealtimeConnectionStatus
  presenceStatus: RealtimePresenceStatus
  documentStatus: RealtimeDocumentStatus
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
} & RealtimeSingleConnectionOptions

type RealtimeContextCollection<TRealtimeState, TRealtimePresenceData> = {
  RealtimeProvider(props: RealtimeProviderProps): JSX.Element
  useRealtimeContext(): RealtimeContextProps<TRealtimeState, TRealtimePresenceData>
  useConnectionStatus(): RealtimeConnectionStatus
  usePresenceStatus(): RealtimePresenceStatus
  useDocumentStatus(): RealtimeDocumentStatus
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
    getAuthToken,
    publicAuthKey,
    autosave,
    throttle,
    _package,
  }: RealtimeProviderProps) => {
    const {
      connectionStatus,
      presenceStatus,
      documentStatus,
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
      autosave,
      throttle,
      _package,
    })

    return (
      <RealtimeContext.Provider
        value={{
          connectionStatus,
          documentStatus,
          presenceStatus,
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

  const useConnectionStatus = () => {
    const { connectionStatus } = useRealtimeContext()

    if (connectionStatus === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return connectionStatus
  }

  const usePresenceStatus = () => {
    const { presenceStatus } = useRealtimeContext()

    if (presenceStatus === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return presenceStatus
  }

  const useDocumentStatus = () => {
    const { documentStatus } = useRealtimeContext()

    if (documentStatus === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return documentStatus
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

  const useCollaborators = (
    selector?: (root: PresenceClient<TRealtimePresenceData>[]) => any,
    equalityFn?: (a: any, b: any) => boolean,
  ) => {
    const { useCollaborators } = useRealtimeContext()

    if (useCollaborators === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return selector ? useCollaborators(selector, equalityFn) : useCollaborators()
  }

  const useSubscribeCollaborators = (): SubscribeCollaborators<TRealtimePresenceData> => {
    const { subscribeCollaborators } = useRealtimeContext()

    if (subscribeCollaborators === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribeCollaborators
  }

  const useMe = (
    selector?: (root: PresenceClient<TRealtimePresenceData>) => any,
    equalityFn?: (a: any, b: any) => boolean,
  ) => {
    const { useMe } = useRealtimeContext()

    if (useMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return selector ? useMe(selector, equalityFn) : useMe()
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
    useConnectionStatus,
    usePresenceStatus,
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
  }
}
