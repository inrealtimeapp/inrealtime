import React from 'react'

import { Patch, Subscribe, UseStore } from './channels/document/store/types'
import { RealtimeGroupContextProps } from './createRealtimeGroupContext'
import { RealtimeGroupConnectionOptions } from './types'
import { RealtimeDocumentStatus, useRealtimeDocument } from './useRealtimeDocument'

export type RealtimeDocumentContextProps<TRealtimeState> = {
  documentStatus: RealtimeDocumentStatus
  useStore: UseStore<TRealtimeState>
  patch: Patch<TRealtimeState>
  subscribe: Subscribe<TRealtimeState>
}

type RealtimeGroupProviderProps = {
  children: React.ReactNode
} & RealtimeGroupConnectionOptions

type RealtimeDocumentProviderProps = {
  children: React.ReactNode
  documentId?: string | undefined
}

type RealtimeContextCollection<TRealtimeState> = {
  RealtimeDocumentProvider(props: RealtimeDocumentProviderProps): JSX.Element
  useRealtimeDocumentContext(): RealtimeDocumentContextProps<TRealtimeState>
  useDocumentStatus(): RealtimeDocumentStatus
  useStore: UseStore<TRealtimeState>
  usePatch(): Patch<TRealtimeState>
  useSubscribe(): Subscribe<TRealtimeState>
}

export const createRealtimeDocumentContext = <TRealtimeState,>({
  useRealtimeGroupContext,
}: {
  useRealtimeGroupContext(): RealtimeGroupContextProps<unknown>
}): RealtimeContextCollection<TRealtimeState> => {
  const RealtimeDocumentContext = React.createContext<Partial<
    RealtimeDocumentContextProps<TRealtimeState>
  > | null>(null)

  const RealtimeDocumentProvider = ({ children, documentId }: RealtimeDocumentProviderProps) => {
    const { connectionStatus, _package } = useRealtimeGroupContext()
    if (_package === null) {
      throw new Error('No RealtimeGroupProvider provided')
    }

    const { documentStatus, useStore, patch, subscribe } = useRealtimeDocument<TRealtimeState>({
      connectionStatus,
      documentId,
      ..._package,
    })

    return (
      <RealtimeDocumentContext.Provider
        value={{
          documentStatus,
          useStore,
          patch,
          subscribe,
        }}
      >
        {children}
      </RealtimeDocumentContext.Provider>
    )
  }

  const useRealtimeDocumentContext = () => {
    return React.useContext(RealtimeDocumentContext) as RealtimeDocumentContextProps<TRealtimeState>
  }
  const useDocumentStatus = () => {
    const { documentStatus } = useRealtimeDocumentContext()

    if (documentStatus === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return documentStatus
  }

  const useStore = (
    selector?: (root: TRealtimeState) => any,
    equalityFn?: ((a: any, b: any) => boolean) | undefined,
  ) => {
    const { useStore } = useRealtimeDocumentContext()

    if (useStore === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return selector ? useStore(selector, equalityFn) : useStore()
  }

  const usePatch = (): Patch<TRealtimeState> => {
    const { patch } = useRealtimeDocumentContext()

    if (patch === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return patch
  }

  const useSubscribe = (): Subscribe<TRealtimeState> => {
    const { subscribe } = useRealtimeDocumentContext()

    if (subscribe === null) {
      throw new Error('No RealtimeProvider provided')
    }

    return subscribe
  }
  return {
    RealtimeDocumentProvider,
    useRealtimeDocumentContext,
    useDocumentStatus,
    useStore,
    usePatch,
    useSubscribe,
  }
}
