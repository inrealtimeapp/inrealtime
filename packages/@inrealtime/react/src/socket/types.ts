import { RealtimeMessage } from '../core'

export enum RealtimeConnectionStatus {
  Closed = 'Closed',
  Connecting = 'Connecting',
  Authenticating = 'Authenticating',
  Open = 'Open',
}

export type MessageStore = {
  registerMessage(channel: string, message: RealtimeMessage): void
  subscribeToChannel(channel: string, listener: (message: RealtimeMessage) => void): () => void
}
