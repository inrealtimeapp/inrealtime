import { MutableRefObject } from 'react'

import { RealtimeMessage } from '../core'

export enum RealtimeWebSocketStatus {
  Closed = 'Closed',
  Connecting = 'Connecting',
  Authenticating = 'Authenticating',
  Open = 'Open',
}

export type MessageStore = {
  registerMessage(channel: string, message: RealtimeMessage): void
  subscribeToChannel(channel: string, listener: (message: RealtimeMessage) => void): () => void
}

export type ClientMessageOptions = {
  channel: string
  message: RealtimeMessage
}

export type RealtimeClient = {
  socketStatus: RealtimeWebSocketStatus
  messageStoreRef: MutableRefObject<MessageStore>
  sendMessage(options: ClientMessageOptions): void
}
