import { produce } from 'immer'

import {
  clone,
  DocumentOperationRequest,
  DocumentOperationResponse,
  DocumentOperationsRequest,
  DocumentOperationsResponse,
  DocumentSetRootRequest,
  DocumentSetRootResponse,
  Fragment,
  FragmentTypeList,
} from '../../../../core'
import { RealtimeStore } from '../types'
import { Debug } from './debug'
import { fragmentToDocument } from './fragmentUtils'
import { createImmutableFragment } from './immutableFragment'
import { minifyOperations } from './minifyOperations'
import { createFragmentIdToPath, FragmentIdToPath } from './pathUtils'

/**
 * Apply operation responses to specified stores
 */
export const applyRemoteOperationsToStores = (
  messages: (DocumentOperationsResponse | DocumentOperationsRequest)[],
  stores: RealtimeStore<any>[],
) => {
  // Flattened list of operations
  const operations = ([] as (DocumentOperationRequest | DocumentOperationResponse)[]).concat(
    ...messages.map((m) => m.operations),
  )

  // Minified operations
  const minifiedOperations = minifyOperations(operations)

  // Create a new messages list with minified operations
  const newMessages: DocumentOperationsResponse[] = [
    {
      messageId: '',
      type: 'ops',
      operations: minifiedOperations,
    },
  ]

  stores.forEach((store) => {
    try {
      store.applyRemoteOperations(newMessages)
    } catch (error) {
      console.error(`Error with store ${store.getName()}`, error)
      throw error
    }
  })
}

/**
 * Apply operation messages to document, fragment and fragmentIdToPath
 */
export const applyRemoteOperationsMessages = <TRealtimeState>({
  document,
  fragment,
  fragmentIdToPath,
  messages,
  storeName,
}: {
  document: TRealtimeState
  fragment: Fragment
  fragmentIdToPath: FragmentIdToPath
  messages: (DocumentOperationsResponse | DocumentOperationsRequest)[]
  storeName: string
}): {
  newDocument: TRealtimeState
  newFragment: Fragment
  newFragmentIdToPath: FragmentIdToPath
} => {
  // Flatten operations
  let operations = messages
    .map((m) => m.operations)
    .reduce(function (a: any, b: any) {
      return a.concat(b)
    }, [])

  // We want to apply the last root operations first if there is any
  // Then remove that operation and those preceding it
  const lastRootIndex = operations.map((o: any) => o.op === 'root').lastIndexOf(true)
  if (lastRootIndex >= 0) {
    const rootOperation = operations[lastRootIndex] as
      | DocumentSetRootRequest
      | DocumentSetRootResponse
    fragment = clone(rootOperation.value)
    document = fragmentToDocument({ fragment })
    fragmentIdToPath = createFragmentIdToPath({ fragment })

    operations = operations.slice(lastRootIndex + 1)
  }

  const immutableFragment = createImmutableFragment(fragment, fragmentIdToPath)

  const newDocument = produce(document, (draftDocument) => {
    for (const operation of operations) {
      switch (operation.op) {
        case 'insert':
          {
            if (Debug.debugRemoteOperations) {
              console.log(
                `[Remote operation in store ${storeName}] Insert started on fragment ${operation.value.id}`,
              )
            }
            const insertWithFragmentIdResult = immutableFragment.insertWithFragmentId({
              insertedFragment: clone(operation.value),
              parentFragmentId: operation.parentId,
            })

            if (!insertWithFragmentIdResult) {
              if (Debug.debugRemoteOperations) {
                console.log(
                  `[Remote operation in store ${storeName}] Insert did not finish on fragment ${operation.value.id}`,
                )
              }
              continue
            }

            const { insertedFragment, parentFragment, parentFragmentPath } =
              insertWithFragmentIdResult
            const insertedDocument = fragmentToDocument({ fragment: insertedFragment })

            const parentDocument = immutableFragment.getSubDocumentFromFragmentPath(
              draftDocument,
              parentFragmentPath,
            )

            // Insert into parent document
            if (parentFragment.type === FragmentTypeList) {
              // Add to list
              const list = parentDocument as any[]
              const documentIndex = insertedFragment.parentListIndex!
              list.splice(documentIndex, 0, insertedDocument)
            } else {
              // Add to map
              const index = insertedFragment.parentMapKey!
              parentDocument[index] = insertedDocument
            }

            if (Debug.debugRemoteOperations) {
              console.log(
                `[Remote operation in store ${storeName}] Insert completed on fragment ${operation.value.id}`,
              )
            }
          }
          break
        case 'replace':
          {
            // Replace is a combination of insert and delete
            const deleteWithFragmentIdResult = immutableFragment.deleteWithFragmentId({
              fragmentId: operation.id,
            })

            if (!deleteWithFragmentIdResult) {
              console.warn('Could not delete fragment before replace')
              continue
            }

            const { removedIndex, parentFragment, parentFragmentPath } = deleteWithFragmentIdResult

            const fragmentToInsert = clone(operation.value)
            if (parentFragment.type === FragmentTypeList) {
              // Its very important that we use this index. On remote the removedIndex will be equal to the index of the operation.
              // Locally it may not be due to moves or inserts it hasn't received yet.
              fragmentToInsert.parentListIndex = removedIndex as number
            }

            const insertWithFragmentIdResult = immutableFragment.insertWithFragmentId({
              insertedFragment: fragmentToInsert,
              parentFragmentId: fragmentToInsert.parentId!,
            })

            if (!insertWithFragmentIdResult) {
              console.warn('Could not insert fragment after replace')
              continue
            }

            const { insertedFragment } = insertWithFragmentIdResult
            const insertedDocument = fragmentToDocument({ fragment: insertedFragment })

            if (insertedFragment.parentListIndex !== fragmentToInsert.parentListIndex) {
              console.warn('Indexed not equal')
            }

            const parentDocument = immutableFragment.getSubDocumentFromFragmentPath(
              draftDocument,
              parentFragmentPath,
            )

            // Insert into parent document
            if (parentFragment.type === FragmentTypeList) {
              // Add to list
              const list = parentDocument as any[]
              const documentIndex = insertedFragment.parentListIndex!
              list[documentIndex] = insertedDocument
            } else {
              // Add to map
              const index = insertedFragment.parentMapKey!
              parentDocument[index] = insertedDocument
            }
          }
          break
        case 'delete':
          {
            if (Debug.debugRemoteOperations) {
              console.log(
                `[Remote operation in store ${storeName}] Delete started on fragment ${operation.id}`,
              )
            }

            const deleteWithFragmentIdResult = immutableFragment.deleteWithFragmentId({
              fragmentId: operation.id,
            })

            if (!deleteWithFragmentIdResult) {
              if (Debug.debugRemoteOperations) {
                console.log(
                  `[Remote operation in store ${storeName}] Delete did not finish on fragment ${operation.id}`,
                )
              }
              continue
            }

            const { removedIndex, parentFragment, parentFragmentPath } = deleteWithFragmentIdResult

            const parentDocument = immutableFragment.getSubDocumentFromFragmentPath(
              draftDocument,
              parentFragmentPath,
            )

            // Delete from document
            if (parentFragment.type === FragmentTypeList) {
              // Remove from list
              const list = parentDocument as any[]
              list.splice(removedIndex as number, 1)
            } else {
              if (!parentDocument) {
                console.log(parentDocument, parentFragment)
              }

              // Remove from map
              delete parentDocument[removedIndex]
            }

            if (Debug.debugRemoteOperations) {
              console.log(
                `[Remote operation in store ${storeName}] Delete successfully on fragment ${operation.id}`,
              )
            }
          }
          break
        case 'move':
          {
            if (Debug.debugRemoteOperations) {
              console.log(
                `[Remote operation in store ${storeName}] Moving fragment ${operation.id}`,
              )
            }
            const moveIndexWithFragmentIdResult = immutableFragment.moveIndexWithFragmentId({
              fragmentId: operation.id,
              toIndex: operation.index,
            })

            if (!moveIndexWithFragmentIdResult) {
              if (Debug.debugRemoteOperations) {
                console.log(
                  `[Remote operation in store ${storeName}] Moving failed for fragment ${operation.id}`,
                )
              }
              continue
            }

            const { fromIndex, toIndex, listFragmentPath } = moveIndexWithFragmentIdResult

            const list = immutableFragment.getSubDocumentFromFragmentPath(
              draftDocument,
              listFragmentPath,
            )
            list.splice(toIndex, 0, list.splice(fromIndex, 1)[0])

            if (Debug.debugRemoteOperations) {
              console.log(
                `[Remote operation in store ${storeName}] Moving was successful for fragment ${operation.id}`,
              )
            }
          }
          break
        default:
          console.warn(
            `Unhandled operation message '${operation.op}' for a ${fragment.type} fragment.`,
          )
          break
      }
    }
  })

  return {
    newDocument: newDocument as TRealtimeState,
    newFragment: immutableFragment.getFragment(),
    newFragmentIdToPath: immutableFragment.getFragmentIdToPath(),
  }
}
