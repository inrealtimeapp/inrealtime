import { Fragment, FragmentTypeList, FragmentTypeMap } from '../../../../core'

export type FragmentPath = string[]
export type ImmerPath = (string | number)[]
export type FragmentIdToPath = { [key: string]: FragmentPath }
export type ImmutablePaths = { [key: string]: boolean }

export const createFragmentIdToPath = ({ fragment }: { fragment: Fragment }): FragmentIdToPath => {
  return addFragmentIdToPath({ fragment, fragmentIdToPath: {} })
}

/**
 * Generate a mapping of fragment id to paths
 */
export const addFragmentIdToPath = ({
  fragment,
  fragmentIdToPath,
  path,
}: {
  fragment: Fragment
  fragmentIdToPath: FragmentIdToPath
  path?: string[]
}): FragmentIdToPath => {
  const queue: { fragment: Fragment; path: string[] }[] = [{ fragment, path: path ?? [] }]
  while (queue.length > 0) {
    const item = queue.shift()!
    fragmentIdToPath[item.fragment.id] = item.path

    // Add all items in map and list
    if (item.fragment.type == FragmentTypeMap || item.fragment.type == FragmentTypeList) {
      const map = item.fragment.value as {
        [key: string]: Fragment
      }
      for (const subKey of Object.keys(map)) {
        const subPath = [...item.path, subKey]
        const mapItem = map[subKey]!
        queue.push({ fragment: mapItem, path: subPath })
      }
    }
  }
  return fragmentIdToPath
}

/**
 * Remove fragment from fragment id to path mapping
 */

export const removeFragmentIdToPath = ({
  fragment,
  fragmentIdToPath,
}: {
  fragment: Fragment
  fragmentIdToPath: FragmentIdToPath
}): FragmentIdToPath => {
  const queue: Fragment[] = [fragment]
  while (queue.length > 0) {
    const item = queue.shift()!
    delete fragmentIdToPath[item.id]
    // Add all items in map and list
    if (item.type == FragmentTypeMap || item.type == FragmentTypeList) {
      const map = item.value as {
        [key: string]: Fragment
      }
      for (const subKey of Object.keys(map)) {
        const mapItem = map[subKey]!
        queue.push(mapItem)
      }
    }
  }
  return fragmentIdToPath
}
