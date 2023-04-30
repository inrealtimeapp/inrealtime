import { useMemo } from 'react'

import {
  DocumentAvailabilityStatus,
  DocumentSubscriptionStatus,
  useDocumentChannel,
} from './channels/document/useDocument'
import { getThrottle } from './throttle'
import { RealtimeDocumentOptions } from './types'

export enum RealtimeDocumentStatus {
  Unready = 'Unready',
  Ready = 'Ready',
}

export const useRealtimeDocument = <TRealtimeState>({
  config,
  connectionStatus,
  useChannel,
  documentId,
  throttle: throttleOption,
}: RealtimeDocumentOptions) => {
  const throttle = useMemo(() => getThrottle(throttleOption), [throttleOption])

  // Document channel
  const { availabilityStatus, subscriptionStatus, useStore, patch, subscribe } =
    useDocumentChannel<TRealtimeState>({
      config,
      connectionStatus,
      useChannel,
      documentId,
      throttle,
    })

  const documentStatus = useMemo(() => {
    if (
      availabilityStatus === DocumentAvailabilityStatus.Ready ||
      availabilityStatus === DocumentAvailabilityStatus.ReadyLocal ||
      subscriptionStatus == DocumentSubscriptionStatus.Ready
    ) {
      return RealtimeDocumentStatus.Ready
    }
    return RealtimeDocumentStatus.Unready
  }, [availabilityStatus, subscriptionStatus])

  return {
    documentStatus,
    useStore,
    patch,
    subscribe,
  }
}
