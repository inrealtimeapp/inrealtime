import { Fragment, FragmentList, FragmentMap, FragmentTypeList } from '../../../../core'
import {
  addFragmentIdToPath,
  FragmentIdToPath,
  FragmentPath,
  ImmerPath,
  ImmutablePaths,
  removeFragmentIdToPath,
} from './pathUtils'

type InsertFragment = {
  insertedFragment: Fragment
  insertedIndex: string | number
  parentFragment: Fragment
  parentFragmentPath: FragmentPath
}

type DeleteFragment = {
  removedFragment: Fragment
  removedIndex: string | number
  parentFragment: Fragment
  parentFragmentPath: FragmentPath
}

type MoveFragment = {
  movedFragment: Fragment
  listFragmentPath: FragmentPath
  fromIndex: number
  toIndex: number
}

export const createImmutableFragment = (
  fragment: Fragment,
  fragmentIdToPath: FragmentIdToPath,
): IImmutableFragment => {
  return new ImmutableFragment(fragment, fragmentIdToPath)
}

export interface IImmutableFragment {
  getFragment(): Fragment
  getFragmentIdToPath(): FragmentIdToPath
  insertAtImmerPath({}: {
    insertedFragment: Fragment
    parentImmerPath: ImmerPath
    index: string | number
  }): InsertFragment
  insertWithFragmentId({}: {
    insertedFragment: Fragment
    parentFragmentId: string
  }): InsertFragment | undefined
  deleteAtImmerPath({}: { immerPath: ImmerPath }): DeleteFragment
  deleteWithFragmentId({}: { fragmentId: string }): DeleteFragment | undefined
  moveIndexAtImmerPath({}: {
    listImmerPath: ImmerPath
    fromIndex: number
    toIndex: number
  }): MoveFragment
  moveIndexWithFragmentId({}: { fragmentId: string; toIndex: number }): MoveFragment | undefined
  getSubDocumentFromFragmentPath(document: any, path: FragmentPath): any
  replaceFragment({}: {
    oldFragment: Fragment
    newFragment: Fragment
    newFragmentPath: FragmentPath
    parentId: string
  }): { parentFragment: Fragment }
}

export class ImmutableFragment implements IImmutableFragment {
  _fragment: Fragment
  _fragmentIdToPath: FragmentIdToPath
  readonly _immutablePaths: ImmutablePaths

  constructor(fragment: Fragment, fragmentIdToPath: FragmentIdToPath) {
    this._fragment = fragment
    this._fragmentIdToPath = fragmentIdToPath
    this._immutablePaths = {}
  }

  getFragment(): Fragment {
    return this._fragment
  }

  getFragmentIdToPath(): FragmentIdToPath {
    return this._fragmentIdToPath
  }

  /**
   * Generate a string from a path
   */
  _createImmutablePath(path: FragmentPath): string {
    // We create a new string which escapes all dots in each path item, then joins the path by dots.
    return path.map((p) => `${p}`.replace(/\./g, '\\.')).join('.')
  }

  /**
   * Combine two immutable paths
   */
  _combineImmutablePaths(path1: string, path2: string): string {
    return `${path1}.${path2}`
  }

  /**
   * Check if path has been made immutable
   */
  _isPathImmutable(path: string): boolean {
    return !!this._immutablePaths[path]
  }

  /**
   * Add immutable path
   */
  _addImmutablePath(path: string): void {
    this._immutablePaths[path] = true
  }

  /**
   * Remove immutable path
   */
  _removeImmutablePath(path: string): void {
    delete this._immutablePaths[path]
  }

  /**
   * Get fragment path from immer path
   */
  _getFragmentPathFromImmerPath(immerPath: ImmerPath): FragmentPath {
    const fragmentPath: FragmentPath = []
    let subFragment = this._fragment
    for (let i = 0; i < immerPath.length; ++i) {
      let subPath: string
      if (subFragment.type === FragmentTypeList) {
        const listIndex = immerPath[i] as number
        subPath = Object.values(subFragment.value).find((f) => f.parentListIndex === listIndex)!.id
      } else {
        subPath = immerPath[i] as string
      }
      subFragment = (subFragment as FragmentMap | FragmentList).value[subPath]
      fragmentPath.push(subPath)
    }
    return fragmentPath
  }

  /**
   * Get an immutable sub fragment based on a fragment path
   */
  _getFragmentFromFragmentPath({ path }: { path: FragmentPath }): {
    fragment: Fragment
    immutablePath: string
  } {
    let fragment = this._fragment
    let immutablePath = ''
    if (!this._isPathImmutable(immutablePath)) {
      this._addImmutablePath(immutablePath)
      fragment = { ...fragment }

      if ((fragment as FragmentMap | FragmentList).value) {
        ;(fragment as FragmentMap | FragmentList).value = {
          ...(fragment as FragmentMap | FragmentList).value,
        }
      }
    }

    let subFragment = fragment

    for (let i = 0; i < path.length; ++i) {
      if (subFragment === undefined) {
        break
      }

      const index = path[i]

      const immutableSubPath = this._createImmutablePath([index])
      immutablePath = immutablePath
        ? this._combineImmutablePaths(immutablePath, immutableSubPath)
        : immutableSubPath

      const listOrMap = subFragment as FragmentList | FragmentMap
      let nextSubFragment = listOrMap.value[index]
      if (!this._isPathImmutable(immutablePath)) {
        this._addImmutablePath(immutablePath)
        nextSubFragment = { ...nextSubFragment }
        if ((nextSubFragment as FragmentMap | FragmentList).value) {
          ;(nextSubFragment as FragmentMap | FragmentList).value = {
            ...(nextSubFragment as FragmentMap | FragmentList).value,
          }
        }
        listOrMap.value[index] = nextSubFragment
      }

      subFragment = nextSubFragment
    }

    // Update head fragment
    this._fragment = fragment

    return { fragment: subFragment, immutablePath }
  }

  /**
   * Get an immutable sub fragments list based on an immer path
   * Only make items which are within index [itemImmutabilityFromIndex, itemImmutabilityToIndex]
   */
  _getListFragments = ({
    listFragment,
    listImmutablePath,
    itemImmutabilityFromIndex,
    itemImmutabilityToIndex,
  }: {
    listFragment: FragmentList
    listImmutablePath: string
    itemImmutabilityFromIndex: number
    itemImmutabilityToIndex: number
  }): Fragment[] => {
    return Object.values(listFragment.value).map((f) => {
      const subImmutablePath = this._combineImmutablePaths(listImmutablePath, f.id)
      if (
        !this._isPathImmutable(subImmutablePath) &&
        f.parentListIndex! >= itemImmutabilityFromIndex &&
        f.parentListIndex! <= itemImmutabilityToIndex
      ) {
        this._addImmutablePath(subImmutablePath)
        f = { ...f }
        if ((f as FragmentList | FragmentMap).value) {
          ;(f as FragmentList | FragmentMap).value = { ...(f as FragmentList | FragmentMap).value }
        }
        listFragment.value[f.id] = f
      }
      return f
    })
  }

  /**
   * Get a fragment and a parent fragment from fragment id
   */
  _getFragmentAndParentFragment({ fragmentPath }: { fragmentPath: FragmentPath }): {
    fragment: Fragment
    fragmentImmutablePath: string
    parentFragment: Fragment
    parentFragmentPath: FragmentPath
    parentFragmentImmutablePath: string
  } {
    // Get moved fragment
    const { fragment, immutablePath: fragmentImmutablePath } = this._getFragmentFromFragmentPath({
      path: fragmentPath,
    })

    // Get parent fragment
    const parentFragmentPath = this._fragmentIdToPath[fragment.parentId!]
    const { fragment: parentFragment, immutablePath: parentFragmentImmutablePath } =
      this._getFragmentFromFragmentPath({
        path: parentFragmentPath,
      })

    return {
      fragment,
      fragmentImmutablePath,
      parentFragment,
      parentFragmentPath,
      parentFragmentImmutablePath,
    }
  }

  /**
   * Insert a fragment with an immer path
   */
  insertAtImmerPath({
    insertedFragment,
    parentImmerPath,
    index,
  }: {
    insertedFragment: Fragment
    parentImmerPath: ImmerPath
    index: string | number
  }): InsertFragment {
    const parentFragmentPath = this._getFragmentPathFromImmerPath(parentImmerPath)
    return this._insertFragment({ insertedFragment, parentFragmentPath, index })
  }

  /**
   * Insert a fragment inside a specific parent fragment id
   */
  insertWithFragmentId({
    insertedFragment,
    parentFragmentId,
  }: {
    insertedFragment: Fragment
    parentFragmentId: string
  }): InsertFragment | undefined {
    const parentFragmentPath = this._fragmentIdToPath[parentFragmentId]
    if (!parentFragmentPath) {
      return undefined
    }
    return this._insertFragment({ insertedFragment, parentFragmentPath })
  }

  /**
   * Insert a fragment at a fragment path
   */
  _insertFragment({
    insertedFragment,
    parentFragmentPath,
    index,
  }: {
    insertedFragment: Fragment
    parentFragmentPath: FragmentPath
    index?: string | number
  }): InsertFragment {
    // Get parent fragment
    const { fragment: parentFragment, immutablePath: parentFragmentImmutablePath } =
      this._getFragmentFromFragmentPath({
        path: parentFragmentPath,
      })

    // If list we need to shift indexes
    let fragmentIndex: string
    let insertedIndex: string | number
    if (parentFragment.type === FragmentTypeList) {
      if (index !== undefined) {
        insertedFragment.parentListIndex = index as number
      }

      // Get list items
      const listFragments = this._getListFragments({
        listFragment: parentFragment,
        listImmutablePath: parentFragmentImmutablePath,
        itemImmutabilityFromIndex: insertedFragment.parentListIndex!,
        itemImmutabilityToIndex: Number.MAX_SAFE_INTEGER,
      })

      // Shift list items to the right
      const toIndex = insertedFragment.parentListIndex!
      const addedIndex = toIndex >= listFragments.length ? listFragments.length : toIndex
      insertedFragment.parentListIndex = addedIndex

      for (const fragment of listFragments) {
        if (fragment.parentListIndex! >= addedIndex) {
          fragment.parentListIndex!++
        }
      }

      fragmentIndex = insertedFragment.id
      insertedIndex = addedIndex
    } else {
      if (index !== undefined) {
        insertedFragment.parentMapKey = index as string
      }

      fragmentIndex = insertedFragment.parentMapKey!
      insertedIndex = insertedFragment.parentMapKey!
    }

    // If replacing fragment
    const oldFragment = (parentFragment as FragmentMap | FragmentList).value[fragmentIndex]
    if (oldFragment) {
      removeFragmentIdToPath({ fragment: oldFragment, fragmentIdToPath: this._fragmentIdToPath })
    }

    // Insert into fragment path
    const fragmentPath = [...parentFragmentPath, fragmentIndex]
    addFragmentIdToPath({
      fragment: insertedFragment,
      fragmentIdToPath: this._fragmentIdToPath,
      path: fragmentPath,
    })

    // Add the fragment to immutable paths
    this._addImmutablePath(this._combineImmutablePaths(parentFragmentImmutablePath, fragmentIndex))

    // Insert into fragment parent
    insertedFragment.parentId = parentFragment.id
    ;(parentFragment as FragmentMap | FragmentList).value[fragmentIndex] = insertedFragment

    return { insertedFragment, insertedIndex, parentFragment, parentFragmentPath }
  }

  /**
   * Delete a fragment with an immer path
   */
  deleteAtImmerPath({ immerPath }: { immerPath: ImmerPath }): DeleteFragment {
    const fragmentPath = this._getFragmentPathFromImmerPath(immerPath)
    return this._deleteFragment({ fragmentPath })
  }

  /**
   * Delete a fragment with a specific fragment id
   */
  deleteWithFragmentId({ fragmentId }: { fragmentId: string }): DeleteFragment | undefined {
    const fragmentPath = this._fragmentIdToPath[fragmentId]
    if (!fragmentPath) {
      return undefined
    }
    return this._deleteFragment({ fragmentPath })
  }

  /**
   * Delete a fragment at a fragment path
   */
  _deleteFragment({ fragmentPath }: { fragmentPath: FragmentPath }): DeleteFragment {
    const fragmentParentResult = this._getFragmentAndParentFragment({ fragmentPath })

    const {
      fragment: removedFragment,
      fragmentImmutablePath,
      parentFragment,
      parentFragmentPath,
      parentFragmentImmutablePath,
    } = fragmentParentResult

    // Remove from fragment path
    removeFragmentIdToPath({
      fragment: removedFragment,
      fragmentIdToPath: this._fragmentIdToPath,
    })

    // Remove the fragment from immutable paths
    this._removeImmutablePath(fragmentImmutablePath)

    let removedIndex: string | number
    if (parentFragment.type === FragmentTypeList) {
      // Delete from parent fragment
      delete parentFragment.value[removedFragment.id]

      // Get list items
      const listFragments = this._getListFragments({
        listFragment: parentFragment,
        listImmutablePath: parentFragmentImmutablePath,
        itemImmutabilityFromIndex: removedFragment.parentListIndex! + 1,
        itemImmutabilityToIndex: Number.MAX_SAFE_INTEGER,
      })

      // Shift list items to the left
      removedIndex = removedFragment.parentListIndex!
      for (const fragment of listFragments) {
        if (fragment.parentListIndex! > removedIndex) {
          fragment.parentListIndex!--
        }
      }
    } else {
      removedIndex = removedFragment.parentMapKey!

      // Delete from parent fragment
      delete (parentFragment as FragmentMap).value[removedFragment.parentMapKey!]
    }

    return { removedFragment, removedIndex, parentFragment, parentFragmentPath }
  }

  /**
   * Move an index of an item in a list fragment from an immer path
   */
  moveIndexAtImmerPath({
    listImmerPath,
    fromIndex,
    toIndex,
  }: {
    listImmerPath: ImmerPath
    fromIndex: number
    toIndex: number
  }): MoveFragment {
    const fragmentPath = this._getFragmentPathFromImmerPath([...listImmerPath, fromIndex])
    return this._moveFragment({ movedFragmentPath: fragmentPath, toIndex })
  }

  /**
   * Move an index in a list from fragment id
   */
  moveIndexWithFragmentId({
    fragmentId,
    toIndex,
  }: {
    fragmentId: string
    toIndex: number
  }): MoveFragment | undefined {
    const fragmentPath = this._fragmentIdToPath[fragmentId]
    if (!fragmentPath) {
      return undefined
    }
    return this._moveFragment({ movedFragmentPath: fragmentPath, toIndex })
  }

  /**
   * Move an index of an item with a fragment path
   */
  _moveFragment({
    movedFragmentPath,
    toIndex,
  }: {
    movedFragmentPath: FragmentPath
    toIndex: number
  }): MoveFragment {
    const fragmentParentResult = this._getFragmentAndParentFragment({
      fragmentPath: movedFragmentPath,
    })!
    const {
      fragment: movedFragment,
      parentFragment: listFragment,
      parentFragmentPath: listFragmentPath,
      parentFragmentImmutablePath: listImmutablePath,
    } = fragmentParentResult

    if (listFragment.type !== FragmentTypeList) {
      throw new Error(
        `Parent of a moved item must be a ${FragmentTypeList}, was ${listFragment.type}.`,
      )
    }

    // Get list items
    const fromIndex = movedFragment.parentListIndex!
    const listFragments = this._getListFragments({
      listFragment: listFragment,
      listImmutablePath: listImmutablePath,
      itemImmutabilityFromIndex: toIndex > fromIndex ? fromIndex : toIndex,
      itemImmutabilityToIndex: toIndex > fromIndex ? toIndex : fromIndex,
    })
    toIndex = toIndex >= listFragments.length ? listFragments.length - 1 : toIndex

    // If moving to the right, shift all keys which are between [fromIndex+1, toIndex] to the left
    if (fromIndex < toIndex) {
      for (const item of listFragments) {
        const listIndex = item.parentListIndex!

        if (listIndex > fromIndex && listIndex <= toIndex) {
          item.parentListIndex!--
        } else if (listIndex === fromIndex) {
          item.parentListIndex = toIndex
        }
      }
    }

    // If moving to the left, shift all keys which are between [toIndex, fromIndex-1] to the right
    if (fromIndex > toIndex) {
      for (const item of listFragments) {
        const listIndex = item.parentListIndex!

        if (listIndex >= toIndex && listIndex < fromIndex) {
          item.parentListIndex!++
        } else if (listIndex === fromIndex) {
          item.parentListIndex = toIndex
        }
      }
    }

    return { movedFragment, listFragmentPath, fromIndex, toIndex }
  }

  /**
   * Replace a fragment with another
   */
  replaceFragment({
    oldFragment,
    newFragment,
    newFragmentPath,
    parentId,
  }: {
    oldFragment: Fragment
    newFragment: Fragment
    newFragmentPath: FragmentPath
    parentId: string
  }): { parentFragment: Fragment } {
    const parentFragmentPath = this._fragmentIdToPath[parentId!]
    const { fragment: parentFragment } = this._getFragmentFromFragmentPath({
      path: parentFragmentPath,
    })

    const fragmentIndex =
      parentFragment.type === FragmentTypeList ? oldFragment.id : oldFragment.parentMapKey!

    // Remove from fragment path
    removeFragmentIdToPath({
      fragment: oldFragment,
      fragmentIdToPath: this._fragmentIdToPath,
    })

    // Insert into fragment path
    addFragmentIdToPath({
      fragment: newFragment,
      fragmentIdToPath: this._fragmentIdToPath,
      path: newFragmentPath,
    })

    // Replace fragment
    ;(parentFragment as FragmentMap | FragmentList).value[fragmentIndex] = newFragment

    // Note We should definitely not add to immutable paths. We want new fragment to be updated if its edited

    return { parentFragment }
  }
  /**
   * Get a sub document based on a fragment path
   */
  getSubDocumentFromFragmentPath(document: any, path: FragmentPath): any {
    let subDocument = document
    let subFragment = this._fragment
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
    return subDocument
  }
}
