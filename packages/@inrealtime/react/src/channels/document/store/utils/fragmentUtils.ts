import {
  clone,
  Fragment,
  FragmentType,
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
      return FragmentType.Null
    case isList(fragment):
      return FragmentType.List
    case isMap(fragment):
      return FragmentType.Map
    case isNumber(fragment):
      return FragmentType.Number
    case isBoolean(fragment):
      return FragmentType.Boolean
    case isString(fragment):
      return FragmentType.String
  }
  throw new Error(`Error evaluating fragment type for value '${fragment}'.`)
}

/**
 * Convert a fragment into the document it represents
 */
export const fragmentToDocument = ({ fragment }: { fragment: Fragment }): any => {
  const rootDocument: any =
    fragment.type == FragmentType.Map
      ? {}
      : fragment.type == FragmentType.List
      ? []
      : clone(fragment.value)
  if (fragment.type !== FragmentType.Map && fragment.type !== FragmentType.List) {
    return rootDocument
  }

  const queue: { documentFragment: Fragment; document: any }[] = [
    { documentFragment: fragment, document: rootDocument },
  ]

  while (queue.length > 0) {
    const { documentFragment, document } = queue.shift()!

    // Add all list items
    if (documentFragment.type == FragmentType.List) {
      const list = Object.values(documentFragment.value).sort(function (a, b) {
        return a.parentListIndex! - b.parentListIndex!
      })

      const listDocument = document as any[]
      for (const listItem of list) {
        const listItemDocument: any =
          listItem.type == FragmentType.Map
            ? {}
            : listItem.type == FragmentType.List
            ? []
            : clone(listItem.value)
        listDocument.push(listItemDocument)

        // Only add map & list items to the queue
        if (listItem.type === FragmentType.Map || listItem.type === FragmentType.List) {
          queue.push({
            documentFragment: listItem,
            document: listItemDocument,
          })
        }
      }
    }

    // Add all items in map
    if (documentFragment.type == FragmentType.Map) {
      const map = documentFragment.value as {
        [key: string]: Fragment
      }
      const mapDocument = document as any
      for (const subKey of Object.keys(map)) {
        const mapItem = map[subKey]!

        const mapItemDocument: any =
          mapItem.type == FragmentType.Map
            ? {}
            : mapItem.type == FragmentType.List
            ? []
            : clone(mapItem.value)
        mapDocument[subKey] = mapItemDocument

        // Only add map & list items to the queue
        if (mapItem.type === FragmentType.Map || mapItem.type === FragmentType.List) {
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
  if (fragment.type == FragmentType.List) {
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
  if (fragment.type == FragmentType.Map) {
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
    type: rootType as any,
    value: rootType == FragmentType.Map || rootType == FragmentType.List ? {} : document,
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
    const document = type == FragmentType.Map || type == FragmentType.List ? {} : rawDocument

    const fragment: Fragment = {
      id: id,
      parentId: parentFragment.id,
      type: type as any,
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
      case FragmentType.List:
        ;(parentFragment.value as any)[fragment.id!] = fragment
        break
      case FragmentType.Map:
        if (parentMapKey) (parentFragment.value as any)[parentMapKey!] = fragment
        break
    }

    // Attach all sub items to the queue (items in list, items in map)
    queue.push(...getFragmentSubItems({ rawDocument, fragment }))
  }
  return rootFragment
}
