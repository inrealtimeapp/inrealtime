import { RealtimeMessage } from '../core'
import { MessageStore } from './types'

export const createMessageStore = (): MessageStore => {
  // Listeners to specific channels
  const listenersToChannel: { [key: string]: Set<(message: RealtimeMessage) => void> } = {}

  const registerMessage = (channel: string, message: RealtimeMessage) => {
    const listeners = listenersToChannel[channel]
    listeners?.forEach((l) => l(message))
  }

  // Subscribe to a specific channel
  const subscribeToChannel = (channel: string, listener: (message: RealtimeMessage) => void) => {
    let listeners = listenersToChannel[channel]
    if (!listeners) {
      listeners = new Set<() => void>()
      listenersToChannel[channel] = listeners
    }

    listeners.add(listener)

    return () => {
      listeners?.delete(listener)
    }
  }

  return {
    registerMessage,
    subscribeToChannel,
  }
}
