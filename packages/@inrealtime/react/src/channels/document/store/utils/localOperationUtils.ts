import { Patch } from 'immer'

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
const _getListOperations = (path: ImmerPath, oldList: any[], newList: any[]): ImmerOperation[] => {
  console.log('old', [...oldList], 'new', [...newList])

  oldList = [...oldList]
  const operations: ImmerOperation[] = []
  let i = 0
  let j = 0
  while (i < oldList.length && j < newList.length) {
    if (oldList[i] === newList[j]) {
      i++
      j++
    } else if (newList.indexOf(oldList[i]) === -1) {
      operations.push({ op: 'delete', path, index: i })
      oldList.splice(i, 1)
    } else if (oldList.indexOf(newList[j]) === -1) {
      operations.push({ op: 'insert', path, index: i, value: newList[j] })
      oldList.splice(i, 0, newList[j])
      i++
      j++
    } else {
      const k = oldList.indexOf(newList[j], i)
      operations.push({ op: 'move', path, oldIndex: k, newIndex: i })
      const temp = oldList[k]
      for (let l = k; l > i; l--) {
        oldList[l] = oldList[l - 1]
      }
      oldList[i] = temp
    }
  }
  while (i < oldList.length) {
    operations.push({ op: 'delete', path, index: i })
    oldList.splice(i, 1)
  }
  while (j < newList.length) {
    operations.push({ op: 'insert', path, index: i++, value: newList[j++] })
  }
  return operations
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
      }

      const oldParentDocument = _getSubDocument(oldDocument, parentPath)
      operations.push(..._getListOperations(parentPath, oldParentDocument, parentDocument))
      continue
    }

    const operationIndex = path[path.length - 1]
    if (currentPatch.op === 'replace' || currentPatch.op === 'remove') {
      operations.push({ op: 'delete', path: parentPath, index: operationIndex })
    }
    if (currentPatch.op === 'replace' || currentPatch.op === 'add') {
      operations.push({
        op: 'insert',
        path: parentPath,
        index: operationIndex,
        value: currentPatch.value,
      })
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
}: {
  fragment: Fragment
  fragmentIdToPath: FragmentIdToPath
  operations: ImmerOperation[]
}): {
  newFragment: Fragment
  newFragmentIdToPath: FragmentIdToPath
  requests: DocumentOperationRequest[]
} => {
  const requests: DocumentOperationRequest[] = []

  let immutableFragment = createImmutableFragment(fragment, fragmentIdToPath)

  console.log('operations', JSON.parse(JSON.stringify(operations)))

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
          const { insertedFragment } = immutableFragment.insertAtImmerPath({
            insertedFragment: documentToFragment(operation.value),
            parentImmerPath: operation.path,
            index: operation.index,
          })

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
          const immerPath: ImmerPath = [...operation.path, operation.index]
          const { removedFragment } = immutableFragment.deleteAtImmerPath({
            immerPath,
          })

          // Insert requests
          requests.push({
            op: 'delete',
            id: removedFragment.id,
            parentId: removedFragment.parentId!,
          })
        }
        break
      case 'move':
        {
          const { movedFragment, toIndex } = immutableFragment.moveIndexAtImmerPath({
            listImmerPath: operation.path,
            fromIndex: operation.oldIndex,
            toIndex: operation.newIndex,
          })

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
