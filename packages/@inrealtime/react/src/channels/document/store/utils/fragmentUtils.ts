import {
  clone,
  Fragment,
  FragmentList,
  FragmentType,
  FragmentTypeBoolean,
  FragmentTypeList,
  FragmentTypeMap,
  FragmentTypeNull,
  FragmentTypeNumber,
  FragmentTypeString,
  isBoolean,
  isList,
  isMap,
  isNumber,
  isString,
  uniqueId,
} from '../../../../core'

export const getFragmentType = (fragment: any): FragmentType => {
  switch (true) {
    case fragment == null:
      return FragmentTypeNull
    case isList(fragment):
      return FragmentTypeList
    case isMap(fragment):
      return FragmentTypeMap
    case isNumber(fragment):
      return FragmentTypeNumber
    case isBoolean(fragment):
      return FragmentTypeBoolean
    case isString(fragment):
      return FragmentTypeString
  }
  throw new Error(`Error evaluating fragment type for value '${fragment}'.`)
}

/**
 * Convert a fragment into the document it represents
 */
export const fragmentToDocument = ({ fragment }: { fragment: Fragment }): any => {
  const rootDocument: any =
    fragment.type == FragmentTypeMap
      ? {}
      : fragment.type == FragmentTypeList
      ? []
      : clone(fragment.value)
  if (fragment.type !== FragmentTypeMap && fragment.type !== FragmentTypeList) {
    return rootDocument
  }

  const queue: { documentFragment: Fragment; document: any }[] = [
    { documentFragment: fragment, document: rootDocument },
  ]

  while (queue.length > 0) {
    const { documentFragment, document } = queue.shift()!

    // Add all list items
    if (documentFragment.type == FragmentTypeList) {
      const list = Object.values(documentFragment.value).sort(function (a, b) {
        return a.parentListIndex! - b.parentListIndex!
      })

      const listDocument = document as any[]
      for (const listItem of list) {
        const listItemDocument: any =
          listItem.type == FragmentTypeMap
            ? {}
            : listItem.type == FragmentTypeList
            ? []
            : clone(listItem.value)
        listDocument.push(listItemDocument)

        // Only add map & list items to the queue
        if (listItem.type === FragmentTypeMap || listItem.type === FragmentTypeList) {
          queue.push({
            documentFragment: listItem,
            document: listItemDocument,
          })
        }
      }
    }

    // Add all items in map
    if (documentFragment.type == FragmentTypeMap) {
      const map = documentFragment.value as {
        [key: string]: Fragment
      }
      const mapDocument = document as any
      for (const subKey of Object.keys(map)) {
        const mapItem = map[subKey]!

        const mapItemDocument: any =
          mapItem.type == FragmentTypeMap
            ? {}
            : mapItem.type == FragmentTypeList
            ? []
            : clone(mapItem.value)
        mapDocument[subKey] = mapItemDocument

        // Only add map & list items to the queue
        if (mapItem.type === FragmentTypeMap || mapItem.type === FragmentTypeList) {
          queue.push({
            documentFragment: mapItem,
            document: mapItemDocument,
          })
        }
      }
    }
  }

  return rootDocument
}

/**
 * Get all sub items of a document fragment to be evaluated as fragments, i.e. added to the queue
 */
const getFragmentSubItems = ({
  rawDocument,
  fragment,
}: {
  rawDocument: any
  fragment: Fragment
}): {
  rawDocument: any
  parentFragment: Fragment
  parentMapKey?: string // If the parent fragment is a map we have to know where to place the item
  parentListIndex?: number // If the parent fragment is a list we have to know where to place the item
}[] => {
  const queue: {
    rawDocument: any
    parentFragment: Fragment
    parentMapKey?: string // If the parent fragment is a map we have to know where to place the item
    parentListIndex?: number // If the parent fragment is a list we have to know where to place the item
  }[] = []

  // Create all items in fragment list
  if (fragment.type == FragmentTypeList) {
    const list = rawDocument as any[]

    list.forEach((listItem, i) => {
      queue.push({
        rawDocument: listItem,
        parentFragment: fragment,
        parentListIndex: i,
      })
    })
  }

  // Create all sub-fragments
  if (fragment.type == FragmentTypeMap) {
    const map = rawDocument as { [key: string]: any }
    for (const subKey of Object.keys(map)) {
      queue.push({
        rawDocument: map[subKey],
        parentFragment: fragment,
        parentMapKey: subKey,
      })
    }
  }
  return queue
}

/**
 * Create a document fragment from a document including a lookup tree
 */
export const documentToFragment = (document: any, rootFragmentId?: string): Fragment => {
  document = clone(document) // Clone the document to avoid consequences of it being edited

  const rootType = getFragmentType(document)
  const rootFragment: Fragment = {
    id: rootFragmentId ?? uniqueId(),
    type: rootType,
    value: rootType == FragmentTypeMap || rootType == FragmentTypeList ? {} : document,
  }

  // Create the initial queue
  const queue: {
    rawDocument: any
    parentFragment: Fragment
    parentMapKey?: string // If the parent fragment is a map we have to know where to place the item
    parentListIndex?: number // If the parent fragment is a list we have to know where to place the item
  }[] = [
    ...getFragmentSubItems({
      rawDocument: document,
      fragment: rootFragment,
    }),
  ]

  while (queue.length > 0) {
    const { rawDocument, parentFragment, parentMapKey, parentListIndex } = queue.shift()!
    const id = uniqueId()
    const type = getFragmentType(rawDocument)
    const document = type == FragmentTypeMap || type == FragmentTypeList ? {} : rawDocument

    const fragment: Fragment = {
      id: id,
      parentId: parentFragment.id,
      type: type,
      value: document,
    }
    if (parentMapKey) {
      fragment.parentMapKey = parentMapKey
    }
    if (parentListIndex !== undefined) {
      fragment.parentListIndex = parentListIndex
    }

    // To build the output fragment we attach the document fragment to its parent
    switch (parentFragment.type) {
      case FragmentTypeList:
        ;(parentFragment.value as any)[fragment.id!] = fragment
        break
      case FragmentTypeMap:
        if (parentMapKey) (parentFragment.value as any)[parentMapKey!] = fragment
        break
    }

    // Attach all sub items to the queue (items in list, items in map)
    queue.push(...getFragmentSubItems({ rawDocument, fragment }))
  }
  return rootFragment
}
