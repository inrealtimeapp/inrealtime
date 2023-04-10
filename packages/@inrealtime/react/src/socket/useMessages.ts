import { useCallback, useEffect } from 'react'

import { RealtimeMessage } from '../core'
import { MessageStore } from './types'

export const useMessages = (
  store: MessageStore,
  channel: string,
  onMessage: (message: RealtimeMessage) => void,
) => {
  const callback = useCallback((message: RealtimeMessage) => onMessage(message), [onMessage])

  useEffect(() => {
    return store.subscribeToChannel(channel, callback)
  }, [store, channel, callback])

  return {}
}
