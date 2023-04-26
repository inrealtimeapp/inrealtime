import { DocumentOperationsRequest, Fragment } from '../../../core'
import { AutosaveDocumentMetadata, IAutosave } from './autosave'

const dbNamePrefix = 'realtime_database'
const fragmentsObjectStoreName = 'fragments'
const documentsMetadataObjectStoreName = 'documents_metadata'
const operationsObjectStoreName = 'operations'
const documentIdInOperationsObjectStore = 'documentIdIndex'
const dbVersion = 1

export class IndexedAutosave implements IAutosave {
  private readonly _storeNamePostfix: string
  private readonly _disableWarning: boolean
  private _database: IDBDatabase | undefined
  private _initPromise: Promise<boolean>
  private _connections = 0

  constructor({
    storeNamePostfix,
    disableWarning,
  }: {
    storeNamePostfix: string
    disableWarning: boolean
  }) {
    this._storeNamePostfix = storeNamePostfix
    this._disableWarning = disableWarning
  }

  connect(): Promise<boolean> {
    if (!window || !window.indexedDB) {
      console.warn(
        "We're sorry to inform you that your current runtime environment does not support the Autosave feature, which is built upon IndexedDB.",
        'As a result, we have disabled the Autosave feature for your current runtime.',
        "However, we're more than happy to help and consider adding support for it if you could kindly send us a message with your use case and runtime environment at support@inrealtime.app.",
      )
      return Promise.resolve(false)
    }

    if (this._database) {
      this._connections++
      return Promise.resolve(true)
    }

    if (!this._initPromise) {
      if (!this._disableWarning) {
        console.warn(
          `Please note that the Realtime autosave feature is still in beta and not yet stable for production use. It currently relies on IndexedDB and is only supported by environments that support it. We're constantly working on improving this feature to ensure seamless and reliable functionality.`,
          `We're exploring new ways to enhance the Realtime package interface, which would allow for selective syncing of messages, seeing the number of changes, applying changes, and more. Our current strategy is to store all changes and sync when connections are made.`,
          `If you have any feedback or suggestions on how we can improve this feature or support more environments, please contact us at support@inrealtime.app. Our team is dedicated to providing you with the best possible experience using our software package.`,
        )
      }

      this._initPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(
          `${dbNamePrefix}_${this._storeNamePostfix}`,
          dbVersion,
        )

        request.onerror = (event: Event) => {
          console.error('Database error:', (event.target as IDBOpenDBRequest).error)
          resolve(false)
        }

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result
          this._database = db
          resolve(true)
        }

        request.onupgradeneeded = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result

          db.createObjectStore(fragmentsObjectStoreName, {
            keyPath: 'id',
          })
          db.createObjectStore(documentsMetadataObjectStoreName, {
            keyPath: 'id',
          })

          const operationsObjectStore = db.createObjectStore(operationsObjectStoreName, {
            keyPath: 'id',
            autoIncrement: true,
          })
          operationsObjectStore.createIndex(documentIdInOperationsObjectStore, 'documentId', {
            unique: false,
          })
        }
      })
    }

    this._connections++
    return this._initPromise
  }

  disconnect(): Promise<void> {
    if (!this._database) {
      return Promise.resolve(undefined as any)
    }
    this._connections--

    if (this._connections > 0) {
      return Promise.resolve(undefined as any)
    }

    this._database.close()
    this._database = undefined
    this._connections = 0
    ;(this._initPromise as any) = undefined
    return Promise.resolve(undefined as any)
  }

  async getDocumentMetadata({
    documentId,
  }: {
    documentId: string
  }): Promise<AutosaveDocumentMetadata | undefined> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(documentsMetadataObjectStoreName, 'readonly')
    const objectStore = transaction.objectStore(documentsMetadataObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const request = objectStore.get(documentId)
      request.onsuccess = () => {
        resolve(request.result?.data)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    return promise as Promise<any>
  }

  saveDocumentMetadata(data: {
    documentId: string
    documentMetadata: AutosaveDocumentMetadata
  }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(documentsMetadataObjectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(documentsMetadataObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put({
        id: data.documentId,
        data: data.documentMetadata,
      })
      putRequest.onsuccess = () => {
        resolve(undefined as any)
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })
    return promise as Promise<any>
  }

  deleteDocumentMetadata({ documentId }: { documentId: string }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(documentsMetadataObjectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(documentsMetadataObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(documentId)
      deleteRequest.onsuccess = () => {
        resolve(undefined as any)
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    return promise as Promise<any>
  }

  getFragment({ documentId }: { documentId: string }): Promise<Fragment | undefined> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(fragmentsObjectStoreName, 'readonly')
    const objectStore = transaction.objectStore(fragmentsObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const request = objectStore.get(documentId)
      request.onsuccess = () => {
        resolve(request.result?.data)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    return promise as Promise<any>
  }

  saveFragment(data: { documentId: string; fragment: Fragment }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(fragmentsObjectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(fragmentsObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put({
        id: data.documentId,
        data: data.fragment,
      })
      putRequest.onsuccess = () => {
        resolve(undefined as any)
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })
    return promise as Promise<void>
  }

  deleteFragment({ documentId }: { documentId: string }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(fragmentsObjectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(fragmentsObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(documentId)
      deleteRequest.onsuccess = () => {
        resolve(undefined as any)
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    return promise as Promise<void>
  }

  async getOperations({
    documentId,
  }: {
    documentId: string
  }): Promise<(DocumentOperationsRequest & { id: number })[] | undefined> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(operationsObjectStoreName, 'readonly')
    const objectStore = transaction.objectStore(operationsObjectStoreName)
    const index = objectStore.index(documentIdInOperationsObjectStore)

    const request = index.getAll(documentId)
    const operations:
      | { id: number; documentId: string; message: DocumentOperationsRequest }[]
      | undefined = await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    if (!operations) {
      return undefined
    }

    operations.sort(function (a, b) {
      return a.id - b.id
    })
    return operations.map((operation) => {
      const messageWithId = operation.message as DocumentOperationsRequest & { id: number }
      messageWithId.id = operation.id
      return messageWithId
    })
  }

  saveOperation(data: {
    documentId: string
    message: DocumentOperationsRequest
  }): Promise<DocumentOperationsRequest & { id: number }> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(operationsObjectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(operationsObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put(data)
      putRequest.onsuccess = () => {
        ;(data.message as any).id = putRequest.result
        resolve(data.message)
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })

    return promise as Promise<any>
  }

  removeOperation(id: number): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(operationsObjectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(operationsObjectStoreName)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(id)
      deleteRequest.onsuccess = () => {
        resolve(undefined as any)
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    return promise as Promise<void>
  }
}
