import { RealtimeConfig } from '../../../config'
import { DocumentOperationsRequest, Fragment } from '../../../core'
import { IAutosave } from './autosave'

const dbNamePrefix = 'realtime_database'
const objectStoreNameFragments = 'fragments'
const objectStoreNameOperations = 'operations'
const dbVersion = 1

export class IndexedAutosave implements IAutosave {
  private readonly _documentId: string
  private readonly _config: RealtimeConfig
  private _database: IDBDatabase | undefined
  private _initPromise: Promise<boolean>

  constructor({ documentId, config }: { documentId: string; config: RealtimeConfig }) {
    this._documentId = documentId
    this._config = config
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

    if (!this._initPromise) {
      if (this._config.autosave.disableWarning) {
        console.warn(
          `Please note that the Realtime autosave feature is still in beta and not yet stable for production use. It currently relies on IndexedDB and is only supported by environments that support it. We're constantly working on improving this feature to ensure seamless and reliable functionality.`,
          `We're exploring new ways to enhance the Realtime package interface, which would allow for selective syncing of messages, seeing the number of changes, applying changes, and more. Our current strategy is to store all changes and sync when connections are made.`,
          `If you have any feedback or suggestions on how we can improve this feature or support more environments, please contact us at support@inrealtime.app. Our team is dedicated to providing you with the best possible experience using our software package.`,
        )
      }
      this._initPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(`${dbNamePrefix}_${this._documentId}`, dbVersion)

        request.onerror = (event: Event) => {
          console.error('Database error:', (event.target as IDBOpenDBRequest).error)
          reject((event.target as IDBOpenDBRequest).error)
        }

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result
          this._database = db

          resolve(true)
        }

        request.onupgradeneeded = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result

          if (!db.objectStoreNames.contains(objectStoreNameFragments)) {
            db.createObjectStore(objectStoreNameFragments, { keyPath: 'id' })
          }

          if (!db.objectStoreNames.contains(objectStoreNameOperations)) {
            db.createObjectStore(objectStoreNameOperations, {
              keyPath: 'id',
              autoIncrement: true,
            })
          }
        }
      })
    }

    return this._initPromise
  }

  disconnect(): Promise<void> {
    if (!this._database) {
      return
    }

    this._database.close()
    console.log('Database closed:', this._database.name, this._database.version)

    this._database = undefined
    ;(this._initPromise as any) = undefined
  }

  getFragment(): Promise<Fragment | undefined> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameFragments, 'readonly')
    const objectStore = transaction.objectStore(objectStoreNameFragments)

    const promise = new Promise((resolve, reject) => {
      const request = objectStore.get(this._documentId)
      request.onsuccess = () => {
        resolve(request.result?.data)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    return promise
  }

  saveFragment(fragment: Fragment): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameFragments, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameFragments)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put({
        id: this._documentId,
        data: fragment,
      })
      putRequest.onsuccess = () => {
        resolve()
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })
    return promise
  }

  deleteFragment(): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameFragments, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameFragments)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(this._documentId)
      deleteRequest.onsuccess = () => {
        resolve()
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    return promise
  }

  async getOperations(): Promise<(DocumentOperationsRequest & { id: number })[] | undefined> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameOperations, 'readonly')
    const objectStore = transaction.objectStore(objectStoreNameOperations)

    const request = objectStore.getAll()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  saveOperation(
    message: DocumentOperationsRequest,
  ): Promise<DocumentOperationsRequest & { id: number }> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameOperations, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameOperations)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put(message)
      putRequest.onsuccess = () => {
        ;(message as any).id = putRequest.result
        resolve(message)
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })

    return promise
  }

  deleteOperations(): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameOperations, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameOperations)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.clear()
      deleteRequest.onsuccess = () => {
        resolve()
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    return promise
  }

  removeOperation(id: number): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameOperations, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameOperations)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(id)
      deleteRequest.onsuccess = () => {
        resolve()
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    return promise
  }
}
