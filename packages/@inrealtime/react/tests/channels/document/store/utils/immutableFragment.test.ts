import { documentToFragment } from '../../../../../src/channels/document/store/utils/fragmentUtils'
import { ImmutableFragment } from '../../../../../src/channels/document/store/utils/immutableFragment'
import {
  addFragmentIdToPath,
  createFragmentIdToPath,
  removeFragmentIdToPath,
} from '../../../../../src/channels/document/store/utils/pathUtils'
import { clone, Fragment, FragmentList, FragmentMap, isNumber } from '../../../../../src/core'

const create = (document: any) => {
  const fragment = documentToFragment(document)
  const fragmentIdToPath = createFragmentIdToPath({ fragment })
  const immutableFragment = new ImmutableFragment(fragment, fragmentIdToPath)
  const clonedFragment = clone(fragment)
  const clonedFragmentIdToPath = clone(fragmentIdToPath)
  return {
    document,
    fragment,
    fragmentIdToPath,
    immutableFragment,
    clonedFragment,
    clonedFragmentIdToPath,
  }
}

const getSubFragment = (
  fragment: Fragment,
  reference: (string | number)[],
): Fragment | undefined => {
  let subReference = fragment
  for (const ref of reference) {
    if (subReference === undefined) {
      continue
    }

    if (isNumber(ref)) {
      const id = Object.values((subReference as FragmentList).value).find(
        (f) => f.parentListIndex! === (ref as number),
      )?.id
      if (!id) {
        return undefined
      }
      subReference = (subReference as FragmentList).value[id]
      continue
    }

    subReference = (subReference as FragmentMap | FragmentList).value[ref]
  }
  return subReference
}

describe('ImmutableFragment', () => {
  test('No action | same fragment', () => {
    const { fragment, immutableFragment, clonedFragmentIdToPath } = create({
      nodes: [{ nodeId: '1' }, { nodeId: '2' }, { nodeId: '3' }],
    })
    expect(immutableFragment.getFragment() === fragment).toEqual(true)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(clonedFragmentIdToPath)
  })

  test('deleteAtImmerPath | list', () => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nodes: [{ nodeId: '1' }, { nodeId: '2' }, { nodeId: '3' }],
    })

    const expectedFragment = clone(clonedFragment)
    const expectedFragmentIdToPath = clone(clonedFragmentIdToPath)

    const removedIndex = 1

    // Removed from the cloned fragment to be as expected
    const nodeListFragment = getSubFragment(expectedFragment, ['nodes']) as FragmentList
    const nodeListItemFragments = Object.values(nodeListFragment.value)
    const removedNode = nodeListItemFragments.find((f) => f.parentListIndex! === removedIndex)!
    const removedNodeId = removedNode.id
    delete nodeListFragment.value[removedNodeId]
    for (const listItem of nodeListItemFragments) {
      if (listItem.parentListIndex! > removedIndex) {
        listItem.parentListIndex!--
      }
    }
    removeFragmentIdToPath({ fragment: removedNode, fragmentIdToPath: expectedFragmentIdToPath })

    // Do the deletion
    immutableFragment.deleteAtImmerPath({ immerPath: ['nodes', removedIndex] })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nodes']) ===
        getSubFragment(fragment, ['nodes']),
    ).toEqual(false) // Make sure reference has changed
    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(expectedFragmentIdToPath)
  })

  test('deleteAtImmerPath | list nested', () => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nestedNodes: {
        nodes: [{ nodeId: '1' }, { nodeId: '2' }, { nodeId: '3' }],
      },
    })

    const expectedFragment = clone(clonedFragment)
    const expectedFragmentIdToPath = clone(clonedFragmentIdToPath)

    const removedIndex = 1

    // Removed from the cloned fragment to be as expected
    const nodeListFragment = getSubFragment(expectedFragment, [
      'nestedNodes',
      'nodes',
    ]) as FragmentList
    const nodeListItemFragments = Object.values(nodeListFragment.value)
    const removedNode = nodeListItemFragments.find((f) => f.parentListIndex! === removedIndex)!
    const removedNodeId = removedNode.id
    delete nodeListFragment.value[removedNodeId]
    for (const listItem of nodeListItemFragments) {
      if (listItem.parentListIndex! > removedIndex) {
        listItem.parentListIndex!--
      }
    }
    removeFragmentIdToPath({ fragment: removedNode, fragmentIdToPath: expectedFragmentIdToPath })

    // Do the deletion
    immutableFragment.deleteAtImmerPath({ immerPath: ['nestedNodes', 'nodes', removedIndex] })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes']) ===
        getSubFragment(fragment, ['nestedNodes']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes', 'nodes']) ===
        getSubFragment(fragment, ['nestedNodes', 'nodes']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes', 'nodes', 0]) ===
        getSubFragment(fragment, ['nestedNodes', 'nodes', 0]),
    ).toEqual(true) // Make sure reference has NOT changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes', 'nodes', 1]) ===
        getSubFragment(fragment, ['nestedNodes', 'nodes', 2]),
    ).toEqual(false) // Make sure reference has changed

    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(expectedFragmentIdToPath)
  })

  test('deleteAtImmerPath | map nested', () => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nestedMap: {
        map: {
          position: { x: 10, y: 100 },
          secondPosition: { x: 10, y: 100 },
        },
      },
    })

    const expectedFragment = clone(clonedFragment)
    const expectedFragmentIdToPath = clone(clonedFragmentIdToPath)

    // Removed from the cloned fragment to be as expected
    const mapFragment = getSubFragment(expectedFragment, ['nestedMap', 'map']) as FragmentMap
    const removedFragment = mapFragment.value.position
    delete mapFragment.value.position
    removeFragmentIdToPath({
      fragment: removedFragment,
      fragmentIdToPath: expectedFragmentIdToPath,
    })

    // Do the deletion
    immutableFragment.deleteAtImmerPath({ immerPath: ['nestedMap', 'map', 'position'] })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedMap']) ===
        getSubFragment(fragment, ['nestedMap']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedMap', 'map']) ===
        getSubFragment(fragment, ['nestedMap', 'map']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedMap', 'map', 'secondPosition']) ===
        getSubFragment(fragment, ['nestedMap', 'map', 'secondPosition']),
    ).toEqual(true) // Make sure reference has NOT changed

    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(expectedFragmentIdToPath)
  })

  test('insertAtImmerPath | insert into end of list', () => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nodes: [{ nodeId: '1' }, { nodeId: '2' }, { nodeId: '3' }],
    })

    const expectedFragment = clone(clonedFragment)
    const expectedFragmentIdToPath = clone(clonedFragmentIdToPath)

    const { fragment: insertedFragment } = create({
      nodeId: '4',
    })

    const addedAtIndex = 3 // End of list

    // Removed from the expected fragment to be as expected
    const nodeListFragment = getSubFragment(expectedFragment, ['nodes']) as FragmentList
    const expectedInsertedFragment = clone(insertedFragment)
    expectedInsertedFragment.parentId = getSubFragment(fragment, ['nodes'])!.id
    expectedInsertedFragment.parentListIndex = addedAtIndex
    nodeListFragment.value[insertedFragment.id] = expectedInsertedFragment
    addFragmentIdToPath({
      fragment: insertedFragment,
      fragmentIdToPath: expectedFragmentIdToPath,
      path: ['nodes', insertedFragment.id],
    })

    // Do the insertion
    immutableFragment.insertAtImmerPath({
      insertedFragment: insertedFragment,
      parentImmerPath: ['nodes'],
      index: addedAtIndex,
    })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nodes']) ===
        getSubFragment(fragment, ['nodes']),
    ).toEqual(false) // Make sure reference has changed

    for (let i = 0; i < 2; ++i) {
      expect(
        getSubFragment(immutableFragment.getFragment(), ['nodes', i]) ===
          getSubFragment(fragment, ['nodes', i]),
      ).toEqual(true) // Make sure reference has NOT changed
    }

    // Make sure the fragment was inserted
    expect(getSubFragment(immutableFragment.getFragment(), ['nodes', 3])).toEqual(insertedFragment)

    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(expectedFragmentIdToPath)
  })

  test('insertAtImmerPath | insert into middle of nested list', () => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nestedNodes: {
        nodes: [
          { nodeId: '1' },
          { nodeId: '2' },
          { nodeId: '3' },
          { nodeId: '5' },
          { nodeId: '6' },
          { nodeId: '7' },
        ],
      },
    })

    const expectedFragment = clone(clonedFragment)
    const expectedFragmentIdToPath = clone(clonedFragmentIdToPath)

    const { fragment: insertedFragment } = create({
      nodeId: '4',
    })

    const addedAtIndex = 3 // Middle of list

    // Insert into the expected fragment to be as expected
    const nodeListFragment = getSubFragment(expectedFragment, [
      'nestedNodes',
      'nodes',
    ]) as FragmentList
    const expectedInsertedFragment = clone(insertedFragment)
    expectedInsertedFragment.parentId = nodeListFragment.id
    expectedInsertedFragment.parentListIndex = addedAtIndex

    const nodeListItemFragments = Object.values(nodeListFragment.value)
    for (const listItem of nodeListItemFragments) {
      if (listItem.parentListIndex! >= addedAtIndex) {
        listItem.parentListIndex!++
      }
    }
    nodeListFragment.value[insertedFragment.id] = expectedInsertedFragment
    addFragmentIdToPath({
      fragment: expectedInsertedFragment,
      fragmentIdToPath: expectedFragmentIdToPath,
      path: ['nestedNodes', 'nodes', insertedFragment.id],
    })

    // Do the insertion
    immutableFragment.insertAtImmerPath({
      insertedFragment: insertedFragment,
      parentImmerPath: ['nestedNodes', 'nodes'],
      index: addedAtIndex,
    })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes']) ===
        getSubFragment(fragment, ['nestedNodes']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes', 'nodes']) ===
        getSubFragment(fragment, ['nestedNodes', 'nodes']),
    ).toEqual(false) // Make sure reference has changed

    for (let i = 0; i < addedAtIndex; ++i) {
      expect(
        getSubFragment(immutableFragment.getFragment(), ['nodes', i]) ===
          getSubFragment(fragment, ['nodes', i]),
      ).toEqual(true) // Make sure reference has NOT changed
    }

    // Make sure the fragment was inserted
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes', 'nodes', addedAtIndex]),
    ).toEqual(insertedFragment)

    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(expectedFragmentIdToPath)
  })

  test('insertAtImmerPath | map nested | replacing', () => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nestedMap: {
        map: {
          position: { x: 10, y: 100 },
          secondPosition: { x: 10, y: 100 },
        },
      },
    })

    const { fragment: insertedFragment } = create({ x: 10, y: 100 })

    const expectedFragment = clone(clonedFragment)
    const expectedFragmentIdToPath = clone(clonedFragmentIdToPath)

    // Removed from the cloned fragment to be as expected
    const mapFragment = getSubFragment(expectedFragment, ['nestedMap', 'map']) as FragmentMap
    const removedFragment = mapFragment.value.position

    const expectedInsertedFragment = clone(insertedFragment)
    expectedInsertedFragment.parentId = mapFragment.id
    expectedInsertedFragment.parentMapKey = 'position'
    mapFragment.value.position = expectedInsertedFragment

    removeFragmentIdToPath({
      fragment: removedFragment,
      fragmentIdToPath: expectedFragmentIdToPath,
    })
    addFragmentIdToPath({
      fragment: expectedInsertedFragment,
      fragmentIdToPath: expectedFragmentIdToPath,
      path: ['nestedMap', 'map', expectedInsertedFragment.parentMapKey!],
    })

    // Do the insertion
    immutableFragment.insertAtImmerPath({
      insertedFragment: insertedFragment,
      parentImmerPath: ['nestedMap', 'map'],
      index: 'position',
    })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedMap']) ===
        getSubFragment(fragment, ['nestedMap']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedMap', 'map']) ===
        getSubFragment(fragment, ['nestedMap', 'map']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedMap', 'map', 'secondPosition']) ===
        getSubFragment(fragment, ['nestedMap', 'map', 'secondPosition']),
    ).toEqual(true) // Make sure reference has NOT changed

    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(expectedFragmentIdToPath)
  })

  test.each([
    { fromIndex: 2, toIndex: 4 },
    { fromIndex: 4, toIndex: 2 },
    { fromIndex: 0, toIndex: 6 },
    { fromIndex: 6, toIndex: 0 },
  ])('moveIndexAtImmerPath | move within nested list', ({ fromIndex, toIndex }) => {
    const { fragment, immutableFragment, clonedFragment, clonedFragmentIdToPath } = create({
      nestedNodes: {
        nodes: [
          { nodeId: '1' },
          { nodeId: '2' },
          { nodeId: '3' },
          { nodeId: '4' },
          { nodeId: '5' },
          { nodeId: '6' },
          { nodeId: '7' },
        ],
      },
    })

    const expectedFragment = clone(clonedFragment)

    // Removed from the expected fragment to be as expected
    const nodeListFragment = getSubFragment(expectedFragment, [
      'nestedNodes',
      'nodes',
    ]) as FragmentList
    const nodeListItemFragments = Object.values(nodeListFragment.value)
    const movedNode = nodeListItemFragments.find((o) => o.parentListIndex === fromIndex)!
    if (toIndex > fromIndex) {
      for (const listItem of nodeListItemFragments) {
        if (listItem.parentListIndex! > fromIndex && listItem.parentListIndex! <= toIndex) {
          listItem.parentListIndex!--
        }
      }
    }
    if (fromIndex > toIndex) {
      for (const listItem of nodeListItemFragments) {
        if (listItem.parentListIndex! < fromIndex && listItem.parentListIndex! >= toIndex) {
          listItem.parentListIndex!++
        }
      }
    }
    movedNode.parentListIndex = toIndex

    // Do the move
    immutableFragment.moveIndexAtImmerPath({
      listImmerPath: ['nestedNodes', 'nodes'],
      fromIndex,
      toIndex,
    })

    expect(immutableFragment.getFragment() === fragment).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes']) ===
        getSubFragment(fragment, ['nestedNodes']),
    ).toEqual(false) // Make sure reference has changed
    expect(
      getSubFragment(immutableFragment.getFragment(), ['nestedNodes', 'nodes']) ===
        getSubFragment(fragment, ['nestedNodes', 'nodes']),
    ).toEqual(false) // Make sure reference has changed

    // The references items on the edges (i.e. to the left and to the right) of toIndex and fromIndex should not have changed
    for (let i = 0; i < fromIndex; ++i) {
      expect(
        getSubFragment(immutableFragment.getFragment(), ['nodes', i]) ===
          getSubFragment(fragment, ['nodes', i]),
      ).toEqual(true) // Make sure reference has NOT changed
    }
    for (let i = toIndex + 1; i < nodeListItemFragments.length; ++i) {
      expect(
        getSubFragment(immutableFragment.getFragment(), ['nodes', i]) ===
          getSubFragment(fragment, ['nodes', i]),
      ).toEqual(true) // Make sure reference has NOT changed
    }

    // Make sure the fragment was inserted
    expect(fragment).toEqual(clonedFragment) // Make sure fragment hasn't changed

    expect(immutableFragment.getFragment()).toEqual(expectedFragment)
    expect(immutableFragment.getFragmentIdToPath()).toEqual(clonedFragmentIdToPath) // No change should be made to fragmentIdToPath
  })
})
