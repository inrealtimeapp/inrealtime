import { DocumentOperationsRequest, Fragment } from '../../../../core'

export interface IAutosave {
  init(documentId: string): Promise<void>
  getFragment({}: { documentId: string }): Promise<Fragment | undefined>
  saveFragment({}: { documentId: string; fragment: Fragment }): Promise<void>
  deleteFragment({}: { documentId: string }): Promise<void>
  getOperations({}: { documentId: string }): Promise<DocumentOperationsRequest[] | undefined>
  saveOperation({}: { documentId: string; message: DocumentOperationsRequest }): Promise<void>
  deleteOperations({}: { documentId: string }): Promise<void>
  removeOperation({}: { documentId: string; messageId: string }): Promise<void>
}
