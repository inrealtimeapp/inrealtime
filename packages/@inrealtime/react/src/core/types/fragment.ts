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
  type: FragmentType.Null
  value: null | undefined
}

export type FragmentBoolean = BaseFragment & {
  type: FragmentType.Boolean
  value: boolean
}

export type FragmentString = BaseFragment & {
  type: FragmentType.String
  value: string
}

export type FragmentNumber = BaseFragment & {
  type: FragmentType.Number
  value: number
}

export type FragmentList = BaseFragment & {
  type: FragmentType.List
  value: { [key: string]: Fragment }
}

export type FragmentMap = BaseFragment & {
  type: FragmentType.Map
  value: { [key: string]: Fragment }
}

export type Fragment =
  | FragmentNull
  | FragmentBoolean
  | FragmentString
  | FragmentNumber
  | FragmentList
  | FragmentMap

export enum FragmentType {
  Null,
  List,
  Map,
  Number,
  Boolean,
  String,
}
