import { BroadcastEventResponse } from '../../core'

export type BroadcastStore = {
  registerEvent(event: BroadcastEventResponse): void
  subscribeToEvents(listener: (event: BroadcastEventResponse) => void | Promise<void>): () => void
}

export const createBroadcastStore = (): BroadcastStore => {
  const listeners: Set<(event: BroadcastEventResponse) => void | Promise<void>> = new Set()

  const registerEvent = (event: BroadcastEventResponse) => {
    listeners?.forEach((l) => l(event))
  }

  const subscribeToEvents = (listener: (event: BroadcastEventResponse) => void | Promise<void>) => {
    listeners.add(listener)

    return () => {
      listeners?.delete(listener)
    }
  }

  return {
    registerEvent,
    subscribeToEvents,
  }
}
