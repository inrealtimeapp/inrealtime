import { produce } from 'immer'

import {
  Fragment,
  FragmentMap,
  FragmentTypeList,
  FragmentTypeMap,
  listsShallowEqual,
  listsShallowStartsWith,
} from '../../../../core'
import { createImmutableFragment, IImmutableFragment } from './immutableFragment'
import { FragmentIdToPath, FragmentPath } from './pathUtils'

/**
 * Get a sub document and fragment based on a fragment path
 * Note: This should not be used when we're going to be modifying fragments!
 */
const _getFromFragmentPath = (
  document: any,
  fragment: Fragment,
  path: FragmentPath,
): { subDocument: any; subFragment: Fragment } => {
  let subDocument = document
  let subFragment = fragment
  for (let i = 0; i < path.length; ++i) {
    if (subFragment === undefined) {
      break
    }
    subFragment = (subFragment as FragmentMap).value[path[i]]
    subDocument =
      subDocument[
        subFragment.parentListIndex !== undefined
          ? subFragment.parentListIndex!
          : subFragment.parentMapKey!
      ]
  }
  return { subDocument, subFragment }
}

/**
 * Replace a conflicted document and fragment with the truth
 */
const _replaceConflictWithTruth = <TRealtimeState>({
  conflictFragment,
  draftDocument,
  immutableFragment,
  truthDocument,
  truthFragment,
  truthFragmentPath,
}: {
  conflictFragment: Fragment
  draftDocument: TRealtimeState
  immutableFragment: IImmutableFragment
  truthDocument: TRealtimeState
  truthFragment: Fragment
  truthFragmentPath: string[]
}) => {
  const parentFragmentPath = immutableFragment.getFragmentIdToPath()[conflictFragment.parentId!]
  const parentDocument = immutableFragment.getSubDocumentFromFragmentPath(
    draftDocument,
    parentFragmentPath,
  )

  /**
   * Note: We are actually implementing references of the truth fragment and document.
   * These values should not be modified here, only inserted.
   * They should also not be modified in functions calling this one.
   */

  const { parentFragment } = immutableFragment.replaceFragment({
    oldFragment: conflictFragment,
    newFragment: truthFragment,
    newFragmentPath: truthFragmentPath,
    parentId: conflictFragment.parentId!,
  })

  // Parent is lists
  if (parentFragment.type === FragmentTypeList) {
    // Insert truth document
    // Note that we want to use the previous index here. This is because we don't want to modify the new or old fragment.
    // If there were any index changes, this will be resolved as the parent should also be affected
    ;(parentDocument as any[]).splice(conflictFragment.parentListIndex!, 1, truthDocument)

    return
  }

  if (parentFragment.type === FragmentTypeMap) {
    // Insert the truth document
    parentDocument[conflictFragment.parentMapKey!] = truthDocument
  }
}

/**
 * Resolve conflicts
 */
export const resolveConflictsInStore = <TRealtimeState>({
  conflictFragmentIds,
  conflictStore,
  truthStore,
}: {
  conflictFragmentIds: string[]
  conflictStore: {
    document: TRealtimeState
    fragment: Fragment
    fragmentIdToPath: FragmentIdToPath
  }
  truthStore: {
    document: TRealtimeState
    fragment: Fragment
    fragmentIdToPath: FragmentIdToPath
  }
}): {
  newDocument: TRealtimeState
  newFragment: Fragment
  newFragmentIdToPath: FragmentIdToPath
} => {
  // Filter duplicates
  conflictFragmentIds = conflictFragmentIds.filter((v, i, a) => a.indexOf(v) === i)

  const immutableFragment = createImmutableFragment(
    conflictStore.fragment,
    conflictStore.fragmentIdToPath,
  )

  const newDocument = produce(conflictStore.document, (draftDocument) => {
    const replacedPaths: string[][] = []
    for (const id of conflictFragmentIds) {
      const truthFragmentPath = truthStore.fragmentIdToPath[id]
      const conflictFragmentPath = immutableFragment.getFragmentIdToPath()[id]

      if (!truthFragmentPath || !conflictFragmentPath) {
        continue
      }

      // If fragment paths don't equal then another conflicted fragment handles the conflict
      if (!listsShallowEqual(truthFragmentPath, conflictFragmentPath)) {
        continue
      }

      // If the current conflict path is a subset has already been handled, then we can skip the current conflict
      // e.g. if path [nodes] has been handled, then we don't have to handle [nodes, id]
      if (replacedPaths.find((path) => listsShallowStartsWith(path, conflictFragmentPath))) {
        continue
      }

      const { subDocument: truthDocument, subFragment: truthFragment } = _getFromFragmentPath(
        truthStore.document,
        truthStore.fragment,
        truthFragmentPath,
      )

      const { subDocument: conflictDocument, subFragment: conflictFragment } = _getFromFragmentPath(
        conflictStore.document,
        conflictStore.fragment,
        conflictFragmentPath,
      )

      if (!truthFragment || !conflictFragment) {
        continue
      }

      if (conflictFragment.type !== truthFragment.type) {
        _replaceConflictWithTruth({
          conflictFragment,
          draftDocument,
          immutableFragment,
          truthDocument,
          truthFragment,
          truthFragmentPath,
        })
        replacedPaths.push(conflictFragmentPath)
        continue
      }

      if (truthFragment.type === FragmentTypeMap && conflictFragment.type === FragmentTypeMap) {
        // We need to check whether the sub fragment id's of the inserted fragment are the same
        // If not, we need to replace the map
        const fragmentKeys = Object.keys(conflictFragment.value)
        const truthFragmentKeys = Object.keys(truthFragment.value)
        let replaceMap = false
        if (fragmentKeys.length !== truthFragmentKeys.length) {
          replaceMap = true
        }
        if (!replaceMap) {
          for (const key of truthFragmentKeys) {
            const truthSubFragment = truthFragment.value[key]
            const subFragment = conflictFragment.value[key]
            if (truthSubFragment.id !== subFragment.id) {
              replaceMap = true
              break
            }
          }
        }

        if (!replaceMap) {
          continue
        }

        // Replace the conflict
        _replaceConflictWithTruth({
          conflictFragment,
          draftDocument,
          immutableFragment,
          truthDocument,
          truthFragment,
          truthFragmentPath,
        })
        replacedPaths.push(conflictFragmentPath)
        continue
      }

      // Resolve conflict for all objects other than map and list
      if (truthFragment.type !== FragmentTypeList || conflictFragment.type !== FragmentTypeList) {
        // No conflict
        if (truthDocument === conflictDocument) {
          continue
        }

        // Replace the conflict
        _replaceConflictWithTruth({
          conflictFragment,
          draftDocument,
          immutableFragment,
          truthDocument,
          truthFragment,
          truthFragmentPath,
        })
        replacedPaths.push(conflictFragmentPath)
        continue
      }

      // Resolve lists
      const truthSubFragmentIds = Object.keys(truthFragment.value)
      const subFragmentIds = Object.keys(conflictFragment.value)

      // Check if we need to replace the list
      let replaceList = false
      if (subFragmentIds.length !== truthSubFragmentIds.length) {
        replaceList = true
      }
      if (!replaceList) {
        // If any id is missing we need to replace the list
        replaceList = !!truthSubFragmentIds.find((id) => !conflictFragment.value[id])
      }

      // Replace the list
      if (replaceList) {
        _replaceConflictWithTruth({
          conflictFragment,
          draftDocument,
          immutableFragment,
          truthDocument,
          truthFragment,
          truthFragmentPath,
        })
        replacedPaths.push(conflictFragmentPath)
        continue
      }

      let reorganizeList = false
      for (const subFragmentId of truthSubFragmentIds) {
        const truthSubFragment = truthFragment.value[subFragmentId]!
        const subFragment = conflictFragment.value[subFragmentId]!

        if (truthSubFragment.parentListIndex === subFragment.parentListIndex) {
          continue
        }

        reorganizeList = true
        subFragment.parentListIndex = truthSubFragment.parentListIndex
      }

      if (!reorganizeList) {
        continue
      }

      // Replace the conflict
      _replaceConflictWithTruth({
        conflictFragment,
        draftDocument,
        immutableFragment,
        truthDocument,
        truthFragment,
        truthFragmentPath,
      })
      replacedPaths.push(conflictFragmentPath)
    }
  })

  return {
    newDocument: newDocument as TRealtimeState,
    newFragment: immutableFragment.getFragment(),
    newFragmentIdToPath: immutableFragment.getFragmentIdToPath(),
  }
}
