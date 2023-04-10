export type RealtimeMessage = { [key: string]: any } & {
  type: string
  messageId: string
  ackMessageId?: string
}
