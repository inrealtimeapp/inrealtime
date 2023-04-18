import { DocumentOperationsRequest, Fragment } from '../../../core'

export interface IAutosave {
  connect(documentId: string): Promise<boolean>
  disconnect(): Promise<void>
  getFragment(): Promise<Fragment | undefined>
  saveFragment(fragment: Fragment): Promise<void>
  deleteFragment(): Promise<void>
  getOperations(): Promise<(DocumentOperationsRequest & { id: number })[] | undefined>

  /**
   * Must return the same reference of the object but with added id
   */
  saveOperation(
    message: DocumentOperationsRequest,
  ): Promise<DocumentOperationsRequest & { id: number }>
  deleteOperations(): Promise<void>
  removeOperation(id: number): Promise<void>
}
