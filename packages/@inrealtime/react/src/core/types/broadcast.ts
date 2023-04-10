export type BroadcastEventRequest = {
  type: string
  data?: any
  recipientClientIds?: string[]
}

export type BroadcastEventResponse = BroadcastEventRequest & {
  clientId: string
}
