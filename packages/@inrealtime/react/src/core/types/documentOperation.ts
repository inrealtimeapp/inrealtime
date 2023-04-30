/**
 * Document operations
 */

import { Fragment } from './fragment'
import { RealtimeMessage } from './realtimeMessage'

export type DocumentOperationResponse =
  | DocumentSetRootResponse
  | DocumentInsertResponse
  | DocumentReplaceResponse
  | DocumentDeleteResponse
  | DocumentMoveResponse

export type DocumentOperationsResponse = {
  messageId: string // The unique identifier of the message
  type: string
  docId: string
  clientId: string
  clientSubId?: string
  operations: DocumentOperationResponse[]
}

export type DocumentSetRootResponse = {
  op: 'root' // The message type
  value: Fragment
}

export type DocumentInsertResponse = {
  op: 'insert' // The message type
  parentId: string // The id of the parent the fragment is being inserted in
  parentMapKey?: string
  parentListIndex?: number
  value: Fragment
}

export type DocumentReplaceResponse = {
  op: 'replace' // The message type
  id: string // The id of the fragment being updated
  value: Fragment
}

export type DocumentDeleteResponse = {
  op: 'delete' // The message type
  id: string // The id of the fragment being deleted
}

export type DocumentMoveResponse = {
  op: 'move' // The message type
  id: string // The id of the fragment being moved
  index: number
}

/**
 * Operation requests
 */
export type DocumentOperationsRequest = {
  messageId: string // The unique identifier of the message
  type: string
  subId: string
  operations: DocumentOperationRequest[]
}

export type DocumentOperationRequest =
  | DocumentSetRootRequest
  | DocumentInsertRequest
  | DocumentReplaceRequest
  | DocumentDeleteRequest
  | DocumentMoveRequest

export type DocumentSetRootRequest = {
  op: 'root' // The message type
  value: Fragment
}

export type DocumentInsertRequest = {
  op: 'insert' // The message type
  parentId: string // The id of the parent the fragment is being inserted in
  parentMapKey?: string
  parentListIndex?: number
  value: Fragment
}

export type DocumentReplaceRequest = {
  op: 'replace' // The message type
  id: string // The id of the fragment being updated
  value: Fragment
}

export type DocumentDeleteRequest = {
  op: 'delete' // The message type
  id: string // The id of the fragment being updated
  parentId: string
}

export type DocumentMoveRequest = {
  op: 'move' // The message type
  id: string // The id of the fragment being moved
  index: number
  parentId: string
}

export const DocumentOperationRoot = 'root'
export const DocumentOperationInsert = 'insert'
export const DocumentOperationReplace = 'replace'
export const DocumentOperationDelete = 'delete'
export const DocumentOperationMove = 'move'

/**
 * Ack response on document operation
 */
export type DocumentOperationAckResponse = RealtimeMessage & {
  docId: string
  subId: string
  ackMessageId: string
  opsMetadata: { [key: number]: any }
}
