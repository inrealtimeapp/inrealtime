import { Fragment } from './fragment'

// TODO Create version messages
export type VersionMetadata = {
  batchCount: number
  batchIds: string[]
  totalTrackedItems: number
}

export type VersionBatch = VersionBatchWithoutItems & {
  trackedItems: number
  items: { [key: string]: number }
}

export type VersionBatchWithoutItems = {
  batchId: string
  batchVersion: number
}

export type VersionsSubscribeRequest = {
  batches?: { batchId: string; versionNumber: number }[]
}

export type VersionBatchChanges = {
  data: {
    batchId: string
    newVersionNumber: number
    changedDocuments: { [key: string]: number }
  }
}
