import { BroadcastEventResponse } from '../../core'

export type Broadcast = (
  type: string,
  options: { data?: any; recipientClientIds?: string[] },
) => void
export type UseBroadcastListener = (
  onEvent: (event: BroadcastEventResponse) => void | Promise<void>,
) => void
