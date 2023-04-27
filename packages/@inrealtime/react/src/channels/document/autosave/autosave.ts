import { DocumentOperationsRequest, Fragment } from '../../../core'

export type AutosaveDocumentMetadata = { localOnly: boolean; unsavedChanges: boolean }

export interface IAutosave {
  /**
   * Must be re-callable, and only execute once per instance.
   * If the connection is disconnected it must be reconnected.
   */
  connect(): Promise<boolean>

  /**
   * Must be re-callable and only execute once per instance.
   */
  disconnect(): Promise<void>

  /**
   * Document metadata
   */
  getDocumentMetadata({}: { documentId: string }): Promise<AutosaveDocumentMetadata | undefined>
  saveDocumentMetadata({}: {
    documentId: string
    documentMetadata: AutosaveDocumentMetadata
  }): Promise<void>
  deleteDocumentMetadata({}: { documentId: string }): Promise<void>

  /**
   * Fragment metadata
   */
  getFragment({}: { documentId: string }): Promise<Fragment | undefined>
  saveFragment({}: { documentId: string; fragment: Fragment }): Promise<void>
  deleteFragment({}: { documentId: string }): Promise<void>

  /**
   * Operations
   * Note: id must be incremental and in order of insertion.
   */
  getOperations({}: {
    documentId: string
  }): Promise<(DocumentOperationsRequest & { id: number })[] | undefined>
  // Save operation must return the same reference of message object but with added id
  saveOperation({}: {
    documentId: string
    message: DocumentOperationsRequest
  }): Promise<DocumentOperationsRequest & { id: number }>
  removeOperation(id: number): Promise<void>
}
