import { useCallback, useEffect, useRef } from 'react'

import { RealtimeConfig } from '../../../config'
import { clone, DocumentOperationsRequest, Fragment } from '../../../core'
import { RealtimeStore } from '../store/types'
import { IAutosave } from './autosave'
import { IndexedAutosave } from './indexeddb_autosave'

export const useAutosave = ({
  config,
  documentId,
  localStore,
  onLocalData,
  onNoLocalData,
}: {
  config: RealtimeConfig
  documentId?: string
  localStore: RealtimeStore<unknown>
  onLocalData: (fragment: Fragment) => void
  onNoLocalData: () => void
}) => {
  // Local autosave database
  const autosaveDatabaseRef = useRef<IAutosave>()

  // Flag to indicate if there are unsaved changes
  const unsavedChangesRef = useRef<boolean>(false)

  // Local changes that have been stored in the autosave database
  const localChangesRef = useRef<(DocumentOperationsRequest & { id: number })[]>([])

  // Local changes that have not been removed from the autosave database
  const unremovedLocalChangesRef = useRef<(DocumentOperationsRequest & { id: number })[]>([])

  // Local changes that have not been stored in the autosave database
  const unsavedLocalChangesRef = useRef<DocumentOperationsRequest[]>([])

  // Mark for saving
  const markForLocalSaving = useCallback(() => {
    unsavedChangesRef.current = true
  }, [])

  // Add local change for saving
  const saveLocalChanges = useCallback((request: DocumentOperationsRequest) => {
    if (!autosaveDatabaseRef.current) {
      return
    }

    unsavedLocalChangesRef.current.push(request)
    markForLocalSaving()
  }, [])

  // Load from local store
  useEffect(() => {
    if (!documentId || !config.autosave) {
      localChangesRef.current = []
      return
    }

    const autosaveDatabase: IAutosave = new IndexedAutosave({ documentId })

    autosaveDatabase.connect(documentId).then(async (enabled) => {
      if (!enabled) {
        return
      }

      autosaveDatabaseRef.current = autosaveDatabase
      const fragmentPromise = autosaveDatabase.getFragment()
      const localChangesPromise = autosaveDatabase.getOperations()
      const fragment = await fragmentPromise
      const localChanges = await localChangesPromise

      if (fragment && localChanges) {
        onLocalData(fragment)
        localChangesRef.current = localChanges
      } else {
        onNoLocalData()
        localChangesRef.current = []
      }
    })
    return () => autosaveDatabase.disconnect()
  }, [documentId])

  // Autosave fragment and changes
  useEffect(() => {
    if (!config.autosave || !documentId) {
      return
    }

    const timer = setInterval(async () => {
      if (!unsavedChangesRef.current) {
        return
      }

      const autosaveDatabase = autosaveDatabaseRef.current
      if (!autosaveDatabase) {
        return
      }

      // We need to initially update local refs to avoid async issues
      const changesToSave = unsavedLocalChangesRef.current
      const changesToRemove = unremovedLocalChangesRef.current
      unremovedLocalChangesRef.current = []
      unsavedLocalChangesRef.current = []
      localChangesRef.current = localChangesRef.current.filter(
        (request) => !changesToRemove.includes(request),
      )
      unsavedChangesRef.current = false

      // Save fragment
      await autosaveDatabase.saveFragment(localStore.getRoot().fragment)

      // Save local changes
      // This needs to occur in the correct row, 1 by 1
      for (const request of changesToSave) {
        try {
          localChangesRef.current.push(await autosaveDatabase.saveOperation(request))
        } catch (error) {
          console.error(error)
        }
      }

      // Remove local changes
      const promises: Promise<any>[] = []
      for (const request of changesToRemove) {
        promises.push(autosaveDatabase.removeOperation(request.id))
      }

      for (const promise of promises) {
        try {
          await promise
        } catch (error) {
          console.error(error)
        }
      }
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [documentId])

  /**
   * Get local changes to sync
   */
  const getLocalChangesToSync = useCallback((): DocumentOperationsRequest[] => {
    if (!autosaveDatabaseRef.current) {
      return []
    }

    let localChanges = [...localChangesRef.current, ...unsavedLocalChangesRef.current]

    // Remove unremoved local changes from local changes
    localChanges = localChanges.filter((request) => {
      return !unremovedLocalChangesRef.current.find((r) => r.messageId === request.messageId)
    })

    return localChanges
  }, [])

  /**
   * Group local changes
   */
  const updateLocalChanges = useCallback(
    ({
      removedChanges,
      addedChanges,
    }: {
      removedChanges: DocumentOperationsRequest[]
      addedChanges: DocumentOperationsRequest[]
    }) => {
      if (!autosaveDatabaseRef.current) {
        return
      }

      // We will need to remove all operations from unsaved local changes
      unsavedLocalChangesRef.current = unsavedLocalChangesRef.current.filter(
        (opMessage) => !removedChanges.includes(opMessage),
      )

      // We will need to add all operations in localChanges to unremovedLocalChanges
      const localChangesToRemove = localChangesRef.current.filter((opMessage) =>
        removedChanges.includes(opMessage),
      )
      unremovedLocalChangesRef.current.push(...localChangesToRemove)

      // We will need to add the new messages
      unsavedLocalChangesRef.current.push(...addedChanges)

      // Mark for saving
      markForLocalSaving()
    },
    [],
  )

  // Acknowledge local change
  const acknowledgeLocalChange = useCallback((ackMessageId: string) => {
    if (!autosaveDatabaseRef.current) {
      return
    }

    // If the local changed hasn't been saved we can just remove it
    // Otherwise we need to remove the operation from the saved local change
    const unsavedLocalChangeIndex = unsavedLocalChangesRef.current.findIndex(
      (r) => r.messageId === ackMessageId,
    )
    if (unsavedLocalChangeIndex >= 0) {
      unsavedLocalChangesRef.current.splice(unsavedLocalChangeIndex, 1)
    } else {
      const localChange = localChangesRef.current.find((r) => r.messageId === ackMessageId)!
      if (localChange) {
        unremovedLocalChangesRef.current.push(localChange)
      } else {
        console.warn("Couldn't find local change for acked operation")
      }
    }

    // Mark for saving
    markForLocalSaving()
  }, [])

  return {
    saveLocalChanges,
    markForLocalSaving,
    getLocalChangesToSync,
    updateLocalChanges,
    acknowledgeLocalChange,
  }
}
