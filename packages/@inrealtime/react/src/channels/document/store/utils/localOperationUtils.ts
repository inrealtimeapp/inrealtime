import { Patch } from 'immer'

import { RealtimeConfig } from '../../../../config'
import {
  clone,
  DocumentOperationRequest,
  Fragment,
  isList,
  listsShallowEqual,
} from '../../../../core'
import { ImmerOperation } from '../types'
import { documentToFragment } from './fragmentUtils'
import { createImmutableFragment } from './immutableFragment'
import { createFragmentIdToPath, FragmentIdToPath, ImmerPath } from './pathUtils'

/**
 * Get sub document from a path.
 *  The path is not the same as a fragment path in that this path contains numbers for indexes in lists,
 *  whereas fragment paths contain fragment ids instead of indexes in lists.
 */
const _getSubDocument = (document: any, path: ImmerPath) => {
  let subDocument = document
  for (let i = 0; i < path.length; ++i) {
    if (subDocument === undefined) {
      break
    }
    subDocument = subDocument[path[i]]
  }
  return subDocument
}

/**
 * Get operations made to a list
 */
const _getListOperations = (
  path: ImmerPath,
  listPatches: Patch[],
  oldList: any[],
  newList: any[],
): ImmerOperation[] => {
  oldList = [...oldList]
  const operations: ImmerOperation[] = []
  let i = 0
  let j = 0
  let previousDeletedOperation: ImmerOperation | undefined = undefined
  while (i < oldList.length && j < newList.length) {
    if (oldList[i] === newList[j]) {
      i++
      j++

      previousDeletedOperation = undefined
    } else if (newList.indexOf(oldList[i]) === -1) {
      const deleteOp: ImmerOperation = { op: 'delete', path, index: i }
      previousDeletedOperation = deleteOp

      operations.push(deleteOp)
      oldList.splice(i, 1)
    } else if (oldList.indexOf(newList[j]) === -1) {
      // If a delete operation was added for the same index we can combine them into a replace operation
      if (previousDeletedOperation && previousDeletedOperation.index === i) {
        // Remove delete operation
        const deletedOpr = operations.splice(-1)[0]
        if (deletedOpr !== previousDeletedOperation) {
          throw new Error('Deleted operation is not the last operation')
        }
        const replaceOp: ImmerOperation = { op: 'replace', path, index: i, value: newList[j] }
        operations.push(replaceOp)
      } else {
        const insertOp: ImmerOperation = { op: 'insert', path, index: i, value: newList[j] }
        operations.push(insertOp)
      }

      oldList.splice(i, 0, newList[j])

      i++
      j++

      previousDeletedOperation = undefined
    } else {
      const k = oldList.indexOf(newList[j], i)
      operations.push({ op: 'move', path, oldIndex: k < 0 ? oldList.length - 1 : k, newIndex: i })
      const temp = oldList[k]
      for (let l = k; l > i; l--) {
        oldList[l] = oldList[l - 1]
      }
      oldList[i] = temp

      previousDeletedOperation = undefined
    }
  }
  while (i < oldList.length) {
    const deleteOp: ImmerOperation = { op: 'delete', path, index: i }
    previousDeletedOperation = deleteOp

    operations.push(deleteOp)
    oldList.splice(i, 1)
  }

  while (j < newList.length) {
    if (previousDeletedOperation && previousDeletedOperation.index === i) {
      // Remove delete operation
      const deletedOpr = operations.splice(-1)[0]
      if (deletedOpr !== previousDeletedOperation) {
        throw new Error('Deleted operation is not the last operation')
      }
      const replaceOp: ImmerOperation = { op: 'replace', path, index: i++, value: newList[j++] }
      operations.push(replaceOp)
    } else {
      const insertOp: ImmerOperation = { op: 'insert', path, index: i++, value: newList[j++] }
      operations.push(insertOp)
    }

    previousDeletedOperation = undefined
  }

  // Remove operations that haven't been applied by immer
  const finalOperations: ImmerOperation[] = []
  for (const operation of operations) {
    if (operation.op !== 'delete' && operation.op !== 'insert' && operation.op !== 'replace') {
      finalOperations.push(operation)
      continue
    }

    const listPatch = listPatches.find(
      (op) => op.path.length > 0 && op.path[op.path.length - 1] === operation.index,
    )
    if (!listPatch) {
      continue
    }

    finalOperations.push(operation)
  }
  return finalOperations
}

/**
 * Convert a list of immer patches into a list of document operations
 */
export const immerPatchesToOperations = <TRealtimeState>({
  patches,
  oldDocument,
  newDocument,
}: {
  patches: Patch[]
  oldDocument: TRealtimeState
  newDocument: TRealtimeState
}): ImmerOperation[] => {
  const operations: ImmerOperation[] = []
  let index = 0

  while (patches.length > index) {
    const currentPatch = patches[index]

    // Replace root
    if (currentPatch.path.length === 0) {
      operations.push({ op: 'root', path: [], value: currentPatch.value })
      index++
      continue
    }

    const path = currentPatch.path
    const parentPath = path.slice(0, -1)

    // List operations
    const parentDocument = _getSubDocument(newDocument, parentPath)
    if (parentDocument && isList(parentDocument)) {
      // Group all list patches together
      const listPatches: Patch[] = [currentPatch]
      while (++index) {
        if (patches.length <= index) {
          break
        }

        // If next list patch isn't modifying the current list, then break
        const nextListPatch = patches[index]
        if (
          nextListPatch.path.length !== path.length ||
          !listsShallowEqual(parentPath, nextListPatch.path.slice(0, -1))
        ) {
          break
        }
        listPatches.push(nextListPatch)
      }

      const oldParentDocument = _getSubDocument(oldDocument, parentPath)
      operations.push(
        ..._getListOperations(parentPath, listPatches, oldParentDocument, parentDocument),
      )
      continue
    }

    const operationIndex = path[path.length - 1]
    switch (currentPatch.op) {
      case 'replace':
        operations.push({
          op: 'replace',
          path: parentPath,
          index: operationIndex,
          value: currentPatch.value,
        })
        break
      case 'add':
        operations.push({
          op: 'insert',
          path: parentPath,
          index: operationIndex,
          value: currentPatch.value,
        })
        break
      case 'remove':
        operations.push({ op: 'delete', path: parentPath, index: operationIndex })
        break
    }
    index++
  }
  return operations
}

/**
 * Apply document operations to a fragment and return a new fragment along with requests to send to server
 */
export const applyPatchOperationsToFragment = ({
  fragment,
  fragmentIdToPath,
  operations,
  config,
}: {
  fragment: Fragment
  fragmentIdToPath: FragmentIdToPath
  operations: ImmerOperation[]
  config: RealtimeConfig
}): {
  newFragment: Fragment
  newFragmentIdToPath: FragmentIdToPath
  requests: DocumentOperationRequest[]
} => {
  const requests: DocumentOperationRequest[] = []

  let immutableFragment = createImmutableFragment(fragment, fragmentIdToPath, config)
  for (const operation of operations) {
    if (operation.op === 'root') {
      if (operations.length > 1) {
        throw new Error('Cannot have more than one operation with set root.')
      }
      const newFragment = documentToFragment(operation.value)
      const newFragmentIdToPath = createFragmentIdToPath({ fragment: newFragment })
      immutableFragment = createImmutableFragment(newFragment, newFragmentIdToPath)
      requests.push({
        op: 'root',
        value: clone(newFragment),
      })
      break
    }

    switch (operation.op) {
      case 'insert':
        {
          if (config.logging.localOperations) {
            console.log(`[Local operation] Inserting fragment`, operation.path, operation.index)
          }

          const { insertedFragment } = immutableFragment.insertAtImmerPath({
            insertedFragment: documentToFragment(operation.value),
            parentImmerPath: operation.path,
            index: operation.index,
          })

          if (config.logging.localOperations) {
            console.log(`[Local operation] Inserted successfully fragment ${insertedFragment.id}`)
          }

          // Insert requests
          requests.push({
            op: 'insert',
            parentId: insertedFragment.parentId!,
            parentMapKey: insertedFragment.parentMapKey,
            parentListIndex: insertedFragment.parentListIndex,
            value: clone(insertedFragment),
          })
        }
        break
      case 'delete':
        {
          if (config.logging.localOperations) {
            console.log(`[Local operation] Removing fragment`, operation.path, operation.index)
          }

          const immerPath: ImmerPath = [...operation.path, operation.index]
          const { removedFragment } = immutableFragment.deleteAtImmerPath({
            immerPath,
          })

          if (config.logging.localOperations) {
            console.log(`[Local operation] Removed fragment successfully ${removedFragment.id}`)
          }

          // Insert requests
          requests.push({
            op: 'delete',
            id: removedFragment.id,
            parentId: removedFragment.parentId!,
          })
        }
        break
      case 'replace':
        {
          // Replace is a combination of delete and insert, except that we inject the old fragment id in the insert request
          if (config.logging.localOperations) {
            console.log(
              '[Local operation start] Replacing fragment',
              operation.path,
              operation.index,
            )
          }

          // Delete
          const immerPath: ImmerPath = [...operation.path, operation.index]
          const { removedFragment } = immutableFragment.deleteAtImmerPath({
            immerPath,
          })

          if (config.logging.localOperations) {
            console.log(
              `[Local operation] Removed fragment ${removedFragment.id} ${removedFragment.parentListIndex} (replace)`,
            )
          }

          // Insert
          const { insertedFragment } = immutableFragment.insertAtImmerPath({
            insertedFragment: documentToFragment(operation.value, removedFragment.id),
            parentImmerPath: operation.path,
            index: operation.index,
          })

          if (config.logging.localOperations) {
            console.log(
              `[Local operation] Inserted fragment ${insertedFragment.id} (replace) - finished`,
            )
          }

          // Insert requests
          requests.push({
            op: 'replace',
            id: insertedFragment.id,
            value: clone(insertedFragment),
          })
        }
        break
      case 'move':
        {
          if (config.logging.localOperations) {
            console.log(
              `[Local operation] Moving fragment`,
              operation.path,
              operation.oldIndex,
              operation.newIndex,
            )
          }

          const { movedFragment, toIndex } = immutableFragment.moveIndexAtImmerPath({
            listImmerPath: operation.path,
            fromIndex: operation.oldIndex,
            toIndex: operation.newIndex,
          })

          if (config.logging.localOperations) {
            console.log(`[Local operation] Moved fragment successfully `, movedFragment.id)
          }
          // Insert requests
          requests.push({
            op: 'move',
            id: movedFragment.id,
            index: toIndex,
            parentId: movedFragment.parentId!,
          })
        }
        break
      default:
        console.warn(`Unhandled operation '${(operation as any).op}' in local operations.`)
        break
    }
  }

  return {
    newFragment: immutableFragment.getFragment(),
    newFragmentIdToPath: immutableFragment.getFragmentIdToPath(),
    requests: requests,
  }
}
