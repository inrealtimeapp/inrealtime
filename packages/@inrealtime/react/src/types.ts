import { AutosaveOption, RealtimeConfig } from './config'
import { GetRealtimeAuthToken } from './core'
import { RealtimeConnectionStatus } from './socket/types'
import { UseChannel } from './socket/useWebSocket'

export type RealtimeConnectionOptions = {
  documentId?: string | undefined
  groupId?: string | undefined
  getAuthToken?: GetRealtimeAuthToken | undefined
  publicAuthKey?: string | undefined
  throttle?: number | undefined
  autosave?: AutosaveOption | undefined
  _package?: RealtimePackageOptions | undefined
}

export type RealtimeDocumentOptions = {
  config: RealtimeConfig
  connectionStatus: RealtimeConnectionStatus
  useChannel: UseChannel
  documentId?: string | undefined
  throttle?: number | undefined
}

export type RealtimePackageOptions = {
  environment?: 'local' | 'development' | 'production'
  logging?: {
    conflicts?: boolean
    socketStatus?: boolean
    listFragmentIndexes?: boolean
    localOperations?: boolean
    remoteOperations?: boolean
  }
}
