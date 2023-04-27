import { useCallback, useEffect, useMemo, useRef } from 'react'

import { AutosaveDocumentMetadata, IAutosave } from './channels/document/autosave/autosave'
import { documentToFragment } from './channels/document/store/utils/fragmentUtils'
import { getAutosaveConfig, getIndexedAutosaveInstance } from './config'

export const useAutosave = (props?: {
  storeNamePostfix?: string | undefined
  disableWarning?: boolean | undefined
}) => {
  const config = useMemo(
    () =>
      getAutosaveConfig({
        enabled: true,
        storeNamePostfix: props?.storeNamePostfix,
        disableWarning: props?.disableWarning,
      }),
    [],
  )

  // Local autosave database
  const autosaveDatabaseRef = useRef<IAutosave>()

  // TODO
  // const { postTabMessage } = useTabBroadcast(
  //   'autosave',
  //   useCallback((data: any) => {
  //     console.log('Hi, received message', data)
  //   }, []),
  // )
  //
  // // Interval for posting messages to other tabs
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     console.log('HO')
  //     postTabMessage({ hello: 'world' })
  //   }, 1000)
  //   return () => {
  //     clearInterval(interval)
  //   }
  // }, [])

  // Load from local store
  useEffect(() => {
    const autosaveDatabase: IAutosave = getIndexedAutosaveInstance({
      storeNamePostfix: config.storeNamePostfix,
      disableWarning: config.disableWarning,
    })

    const connect = async () => {
      const enabled = await autosaveDatabase.connect()
      if (!enabled) {
        return
      }

      autosaveDatabaseRef.current = autosaveDatabase
    }

    connect().catch((error) => {
      console.error(error)
    })
    return () => {
      autosaveDatabase.disconnect().catch((error) => {
        console.error(error)
      })
    }
  }, [])

  const createNewDocument = useCallback(
    async ({ documentId, document }: { documentId: string; document: any }) => {
      if (!autosaveDatabaseRef.current) {
        console.warn('Autosave database not initialized')
        return
      }

      const documentMetadata: AutosaveDocumentMetadata = {
        localOnly: true,
        unsavedChanges: true,
      }
      const fragment = documentToFragment(document)
      await autosaveDatabaseRef.current.saveDocumentMetadata({ documentId, documentMetadata })
      await autosaveDatabaseRef.current.saveFragment({ documentId, fragment })
    },
    [],
  )

  return {
    createNewDocument,
  }
}
