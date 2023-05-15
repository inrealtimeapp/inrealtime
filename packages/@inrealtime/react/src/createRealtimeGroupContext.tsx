import React, { MutableRefObject } from 'react'

import {
  Broadcast,
  PatchMe,
  SubscribeCollaborators,
  SubscribeMe,
  UseBroadcastListener,
  UseCollaborators,
  UseMe,
} from './channels/presence/types'
import { RealtimePresenceStatus } from './channels/presence/usePresence'
import { RealtimeConfig } from './config'
import { PresenceClient } from './core'
import { RealtimeConnectionStatus } from './socket/types'
import { UseChannel } from './socket/useWebSocket'
import { RealtimeGroupConnectionOptions } from './types'
import { useRealtimeConnection } from './useRealtimeConnection'

export type RealtimeGroupContextProps<TRealtimePresenceData> = {
  connectionStatus: RealtimeConnectionStatus
  presenceStatus: RealtimePresenceStatus
  useCollaborators: UseCollaborators<TRealtimePresenceData>
  subscribeCollaborators: SubscribeCollaborators<TRealtimePresenceData>
  useMe: UseMe<TRealtimePresenceData>
  patchMe: PatchMe<TRealtimePresenceData>
  subscribeMe: SubscribeMe<TRealtimePresenceData>
  broadcast: Broadcast
  useBroadcastListener: UseBroadcastListener
  _package: {
    config: RealtimeConfig
    useChannel: UseChannel
    connectionStatusRef: MutableRefObject<RealtimeConnectionStatus>
  }
}

export type RealtimeGroupProviderProps = {
  children: React.ReactNode
} & RealtimeGroupConnectionOptions

export type RealtimeGroupContextCollection<TRealtimePresenceData> = {
  RealtimeGroupProvider(props: RealtimeGroupProviderProps): JSX.Element
  useRealtimeGroupContext(): RealtimeGroupContextProps<TRealtimePresenceData>
  useConnectionStatus(): RealtimeConnectionStatus
  usePresenceStatus(): RealtimePresenceStatus
  useCollaborators: UseCollaborators<TRealtimePresenceData>
  useSubscribeCollaborators(): SubscribeCollaborators<TRealtimePresenceData>
  useMe: UseMe<TRealtimePresenceData>
  usePatchMe(): PatchMe<TRealtimePresenceData>
  useSubscribeMe(): SubscribeMe<TRealtimePresenceData>
  useBroadcast(): Broadcast
  useBroadcastListener: UseBroadcastListener
}

export const createRealtimeGroupContext = <
  TRealtimePresenceData,
>(): RealtimeGroupContextCollection<TRealtimePresenceData> => {
  const RealtimeGroupContext = React.createContext<Partial<
    RealtimeGroupContextProps<TRealtimePresenceData>
  > | null>(null)

  const RealtimeGroupProvider = ({
    children,
    groupId,
    getAuthToken,
    publicAuthKey,
    autosave,
    throttle,
    _package,
  }: RealtimeGroupProviderProps) => {
    const {
      connectionStatus,
      connectionStatusRef,
      presenceStatus,
      useCollaborators,
      subscribeCollaborators,
      useMe,
      patchMe,
      subscribeMe,
      broadcast,
      useBroadcastListener,
      config,
      useChannel,
    } = useRealtimeConnection<TRealtimePresenceData>({
      groupId,
      getAuthToken,
      publicAuthKey,
      autosave,
      throttle,
      _package,
    })

    return (
      <RealtimeGroupContext.Provider
        value={{
          connectionStatus,
          presenceStatus,
          useCollaborators,
          subscribeCollaborators,
          useMe,
          patchMe,
          subscribeMe,
          broadcast,
          useBroadcastListener,
          _package: {
            config,
            useChannel,
            connectionStatusRef,
          },
        }}
      >
        {children}
      </RealtimeGroupContext.Provider>
    )
  }

  const useRealtimeGroupContext = () => {
    return React.useContext(
      RealtimeGroupContext,
    ) as RealtimeGroupContextProps<TRealtimePresenceData>
  }

  const useConnectionStatus = () => {
    const { connectionStatus } = useRealtimeGroupContext()

    if (connectionStatus === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return connectionStatus
  }

  const usePresenceStatus = () => {
    const { presenceStatus } = useRealtimeGroupContext()

    if (presenceStatus === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return presenceStatus
  }

  const useCollaborators = (
    selector?: (root: PresenceClient<TRealtimePresenceData>[]) => any,
    equalityFn?: (a: any, b: any) => boolean,
  ) => {
    const { useCollaborators } = useRealtimeGroupContext()

    if (useCollaborators === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return selector ? useCollaborators(selector, equalityFn) : useCollaborators()
  }

  const useSubscribeCollaborators = (): SubscribeCollaborators<TRealtimePresenceData> => {
    const { subscribeCollaborators } = useRealtimeGroupContext()

    if (subscribeCollaborators === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribeCollaborators
  }

  const useMe = (
    selector?: (root: PresenceClient<TRealtimePresenceData>) => any,
    equalityFn?: (a: any, b: any) => boolean,
  ) => {
    const { useMe } = useRealtimeGroupContext()

    if (useMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return selector ? useMe(selector, equalityFn) : useMe()
  }

  const usePatchMe = (): PatchMe<TRealtimePresenceData> => {
    const { patchMe } = useRealtimeGroupContext()

    if (patchMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return patchMe
  }

  const useSubscribeMe = (): SubscribeMe<TRealtimePresenceData> => {
    const { subscribeMe } = useRealtimeGroupContext()

    if (subscribeMe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribeMe
  }

  const useBroadcast = (): Broadcast => {
    const { broadcast } = useRealtimeGroupContext()

    if (broadcast === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return broadcast
  }

  const useBroadcastListener: UseBroadcastListener = (onEvent) => {
    const { useBroadcastListener } = useRealtimeGroupContext()

    if (useBroadcastListener === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return useBroadcastListener(onEvent)
  }

  return {
    RealtimeGroupProvider,
    useRealtimeGroupContext,
    useConnectionStatus,
    usePresenceStatus,
    useCollaborators,
    useSubscribeCollaborators,
    useMe,
    usePatchMe,
    useSubscribeMe,
    useBroadcast,
    useBroadcastListener,
  }
}
