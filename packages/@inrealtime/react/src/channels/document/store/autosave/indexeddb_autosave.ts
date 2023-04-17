import { DocumentOperationsRequest, Fragment } from '../../../../core'
import { IAutosave } from './autosave'

const dbNamePrefix = 'realtime_database'
const objectStoreNameFragments = 'fragments'
const objectStoreNameOperations = 'operations'
const dbVersion = 1

export class IndexedAutosave implements IAutosave {
  private _database: IDBDatabase | undefined
  private _initPromise: Promise<void>

  init(documentId: string): Promise<void> {
    if (!window.indexedDB) {
      throw new Error('IndexedDB not supported in autosave')
    }

    if (!this._initPromise) {
      this._initPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(`${dbNamePrefix}_${documentId}`, dbVersion)

        request.onerror = (event: Event) => {
          console.error('Database error:', (event.target as IDBOpenDBRequest).error)
          reject((event.target as IDBOpenDBRequest).error)
        }

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result
          this._database = db
          console.log('Database opened:', db.name, db.version)

          if (!db.objectStoreNames.contains(objectStoreNameFragments)) {
            db.createObjectStore(objectStoreNameFragments, { keyPath: 'id' })
            console.log('Object store created:', objectStoreNameFragments)
          }

          resolve()
        }

        request.onupgradeneeded = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result
          console.log('Database upgraded:', db.name, db.version)

          if (!db.objectStoreNames.contains(objectStoreNameFragments)) {
            db.createObjectStore(objectStoreNameFragments, { keyPath: 'id' })
          }

          if (!db.objectStoreNames.contains(objectStoreNameOperations)) {
            db.createObjectStore(objectStoreNameOperations, { keyPath: 'messageId' })
          }
        }
      })
    }

    return this._initPromise
  }

  async getFragment({ documentId }: { documentId: string }): Promise<Fragment | undefined> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    console.log('Getting fragment')

    const transaction = this._database.transaction(objectStoreNameFragments, 'readonly')
    const objectStore = transaction.objectStore(objectStoreNameFragments)

    const request = objectStore.get(documentId)
    const result = new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result?.data)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    return result
  }

  async saveFragment({
    documentId,
    fragment,
  }: {
    documentId: string
    fragment: Fragment
  }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    console.log('Saving fragment')

    const transaction = this._database.transaction(objectStoreNameFragments, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameFragments)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put({
        id: documentId,
        data: fragment,
      })
      putRequest.onsuccess = () => {
        resolve()
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })
    await promise
  }

  async deleteFragment({
    projectId,
    documentId,
  }: {
    projectId: string
    documentId: string
  }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameFragments, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameFragments)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(documentId)
      deleteRequest.onsuccess = () => {
        resolve()
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    await promise
  }

  async getOperations({
    documentId,
  }: {
    documentId: string
  }): Promise<DocumentOperationsRequest[] | undefined> {
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

  async saveOperation({
    documentId,
    message,
  }: {
    documentId: string
    message: DocumentOperationsRequest
  }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    console.log('Saving operation')

    const transaction = this._database.transaction(objectStoreNameOperations, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameOperations)

    const promise = new Promise((resolve, reject) => {
      const putRequest = objectStore.put(message)
      putRequest.onsuccess = () => {
        resolve()
      }
      putRequest.onerror = () => {
        reject(putRequest.error)
      }
    })

    await promise
  }

  async deleteOperations({ documentId }: { documentId: string }): Promise<void> {
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

    await promise
  }

  async removeOperation({
    documentId,
    messageId,
  }: {
    documentId: string
    messageId: string
  }): Promise<void> {
    if (!this._database) {
      throw new Error('Database not initialized')
    }

    const transaction = this._database.transaction(objectStoreNameOperations, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreNameOperations)

    const promise = new Promise((resolve, reject) => {
      const deleteRequest = objectStore.delete(messageId)
      deleteRequest.onsuccess = () => {
        resolve()
      }
      deleteRequest.onerror = () => {
        reject(deleteRequest.error)
      }
    })

    await promise
  }
}
