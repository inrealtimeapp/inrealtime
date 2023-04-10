/**
 * Document operations
 */
export type PermissionType = 'read' | 'write' | 'sync' | 'lock'
export type Permissions = {
  document: PermissionType[]
  presence: PermissionType[]
  broadcast: PermissionType[]
}
export type PresenceClient<TRealtimePresenceData> = {
  clientId: string
  metadata: {
    [key: string]: any
    userId: string
    permissions: Permissions
  }
  data: TRealtimePresenceData
  dataUpdatedAt: string
}

export type PresenceSyncResponse<TRealtimePresenceData> = {
  messageId: string // The unique identifier of the message
  type: 'sync'
  me: {
    clientId: string
  }
  clients: PresenceClient<TRealtimePresenceData>[]
}

/**
 * Client responses (add, remove, update)
 */
export type PresenceClientResponse<TRealtimePresenceData> =
  | PresenceClientAddResponse<TRealtimePresenceData>
  | PresenceClientRemoveResponse
  | PresenceClientReplaceMetadataResponse
  | PresenceClientUpdateDataResponse<TRealtimePresenceData>
  | PresenceClientReplaceDataResponse<TRealtimePresenceData>

export type PresenceClientAddResponse<TRealtimePresenceData> = {
  messageId: string // The unique identifier of the message
  type: 'client_add'
  client: PresenceClient<TRealtimePresenceData>
}

export type PresenceClientRemoveResponse = {
  messageId: string // The unique identifier of the message
  type: 'client_remove'
  clientId: string
}

export type PresenceClientReplaceMetadataResponse = {
  messageId: string // The unique identifier of the message
  type: 'client_replace_metadata'
  clientId: string
  metadata: { [key: string]: any; userId: string; permissions: Permissions }
}

export type PresenceClientUpdateDataResponse<TRealtimePresenceData> = {
  messageId: string // The unique identifier of the message
  type: 'client_update_data'
  clientId: string
  data: TRealtimePresenceData
  dataUpdatedAt: string
}

export type PresenceClientReplaceDataResponse<TRealtimePresenceData> = {
  messageId: string // The unique identifier of the message
  type: 'client_replace_data'
  clientId: string
  data: TRealtimePresenceData
  dataUpdatedAt: string
}
