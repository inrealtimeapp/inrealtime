/**
 * Document fragments
 */
type BaseFragment = {
  id: string // A unique identifier for a fragment
  parentId?: string // The id of the fragment's parent
  parentMapKey?: string // The key of the fragment in its parent map (if, and only if the parent fragment is a map)
  parentListIndex?: number // The index of the fragment is located within its parent list (if, and only if the parent fragment is a list)
}

export type FragmentNull = BaseFragment & {
  type: 'null'
  value: null | undefined
}

export type FragmentBoolean = BaseFragment & {
  type: 'boolean'
  value: boolean
}

export type FragmentString = BaseFragment & {
  type: 'string'
  value: string
}

export type FragmentNumber = BaseFragment & {
  type: 'number'
  value: number
}

export type FragmentList = BaseFragment & {
  type: 'list'
  value: { [key: string]: Fragment }
}

export type FragmentMap = BaseFragment & {
  type: 'map'
  value: { [key: string]: Fragment }
}

export type Fragment =
  | FragmentNull
  | FragmentBoolean
  | FragmentString
  | FragmentNumber
  | FragmentList
  | FragmentMap

export type FragmentType = 'null' | 'list' | 'map' | 'number' | 'boolean' | 'string'

export const FragmentTypeNull = 'null'
export const FragmentTypeBoolean = 'boolean'
export const FragmentTypeString = 'string'
export const FragmentTypeNumber = 'number'
export const FragmentTypeList = 'list'
export const FragmentTypeMap = 'map'
