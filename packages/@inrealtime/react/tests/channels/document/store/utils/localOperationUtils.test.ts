import { enablePatches, produceWithPatches } from 'immer'

import { ImmerOperation } from '../../../../../src/channels/document/store/types'
import { immerPatchesToOperations } from '../../../../../src/channels/document/store/utils/localOperationUtils'
import { ImmerPath } from '../../../../../src/channels/document/store/utils/pathUtils'
import { clone, isList } from '../../../../../src/core'

enablePatches()

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

describe('localOperationUtils', () => {
  test('should return correct list operations', () => {
    const patches: {
      data: any
      operation: (data: any) => void
      expectedOperations: ImmerOperation[]
    }[] = [
      {
        data: {
          list: [1, 2, 3, 4, 5, 6, 7],
        },
        operation: (data: any) => {
          data.list.push(5)
          data.list[0] = 10

          const tmp = data.list[1]
          data.list[1] = data.list[2]
          data.list[2] = tmp

          data.list.splice(3, 1)
          data.list.push(25)
          // Should end in [10, 3, 2, 5, 6, 7, 5, 25]
        },
        expectedOperations: [
          { op: 'replace', path: ['list'], index: 0, value: 10 },
          { op: 'move', path: ['list'], oldIndex: 2, newIndex: 1 },
          { op: 'delete', path: ['list'], index: 3 },
          { op: 'insert', path: ['list'], index: 6, value: 5 },
          { op: 'insert', path: ['list'], index: 7, value: 25 },
        ],
      },
      {
        data: {
          list: [1, 2, 3, 4, 5],
        },
        operation: (data: any) => {
          data.list[2] = 4
          data.list[3] = 6
          data.list[4] = 8
          // Should end in  [1, 2, 4, 6, 8]
        },
        expectedOperations: [
          { op: 'delete', path: ['list'], index: 2 },
          { op: 'delete', path: ['list'], index: 3 },
          { op: 'insert', path: ['list'], index: 3, value: 6 },
          { op: 'insert', path: ['list'], index: 4, value: 8 },
        ],
      },
      {
        data: {
          list: [
            { title: 'Item 1', checked: false },
            { title: 'Item 2', checked: true },
            { title: 'Item 3', checked: false },
          ],
        },
        operation: (data: any) => {
          data.list.push({ title: 'Item 4', checked: false })
          data.list.splice(2, 0, { title: 'Item 5', checked: false })

          data.list[1].checked = false
          data.list[0].checked = true
          /*
            { title: 'Item 1', checked: true },
            { title: 'Item 2', checked: false },
            { title: 'Item 5', checked: false },
            { title: 'Item 3', checked: false },
            { title: 'Item 4', checked: false },
           */
        },
        expectedOperations: [
          { op: 'replace', path: ['list', 0], index: 'checked', value: true },
          {
            op: 'replace',
            path: ['list', 1],
            index: 'checked',
            value: false,
          },
          { op: 'delete', path: ['list'], index: 0 },
          {
            op: 'replace',
            path: ['list'],
            index: 0,
            value: { title: 'Item 1', checked: true },
          },
          {
            op: 'insert',
            path: ['list'],
            index: 1,
            value: { title: 'Item 2', checked: false },
          },
          {
            op: 'insert',
            path: ['list'],
            index: 2,
            value: { title: 'Item 5', checked: false },
          },
          {
            op: 'insert',
            path: ['list'],
            index: 4,
            value: { title: 'Item 4', checked: false },
          },
        ],
      },
      {
        data: {
          list: [
            { title: 'Item 1', checked: false },
            { title: 'Item 2', checked: true },
            { title: 'Item 3', checked: false },
          ],
        },
        operation: (data: any) => {
          data.list = []
        },
        expectedOperations: [{ op: 'replace', path: [], index: 'list', value: [] }],
      },
      {
        data: {
          list: [
            { title: 'Item 1', checked: false },
            { title: 'Item 2', checked: true },
            { title: 'Item 3', checked: false },
          ],
        },
        operation: (data: any) => {
          data.list.splice(0, 1)
        },
        expectedOperations: [{ op: 'delete', path: ['list'], index: 0 }],
      },
      {
        data: {
          list: [
            { title: 'Item 1', checked: false },
            { title: 'Item 2', checked: true },
            { title: 'Item 3', checked: false },
          ],
        },
        operation: (data: any) => {
          data.list.splice(0, data.list.length)
        },
        expectedOperations: [
          { op: 'delete', path: ['list'], index: 0 },
          { op: 'delete', path: ['list'], index: 0 },
          { op: 'delete', path: ['list'], index: 0 },
        ],
      },
    ]

    for (const { data: oldDocument, operation, expectedOperations } of patches) {
      const [newDocument, patches] = produceWithPatches(oldDocument, operation)

      const operations = immerPatchesToOperations({
        patches,
        oldDocument,
        newDocument,
      })

      // Apply the operations and create a new document which should look like 'newDocument'
      const result = clone(oldDocument)
      const operationsCloned = clone(operations)
      operations.forEach(({ op, path, index, value, oldIndex, newIndex }) => {
        if (
          (index !== undefined && index < 0) ||
          (oldIndex !== undefined && oldIndex < 0) ||
          (newIndex !== undefined && newIndex < 0)
        ) {
          throw new Error(`Invalid index in op '${op}'. ${JSON.stringify(operations)}.`)
        }

        const parentDocument = _getSubDocument(result, path)
        switch (op) {
          case 'replace':
            parentDocument[index] = value
            break
          case 'delete':
            if (isList(parentDocument)) {
              parentDocument.splice(index, 1)
            } else {
              delete parentDocument[index]
            }
            break
          case 'insert':
            if (isList(parentDocument)) {
              parentDocument.splice(index, 0, value)
            } else {
              parentDocument[index] = value
            }
            break
          case 'move':
            parentDocument.splice(newIndex, 0, parentDocument[oldIndex])
            parentDocument.splice(oldIndex + (oldIndex > newIndex ? 1 : 0), 1)
            break
          default:
            break
        }
      })

      console.log(
        'operations',
        operations,
        'patches',
        patches,
        'newDocument',
        newDocument,
        'oldDocument',
        oldDocument,
        'result',
        result,
      )
      console.log('operationsCloned', operationsCloned, expectedOperations)
      expect(result).toEqual(newDocument)
      expect(expectedOperations).toEqual(operationsCloned)
    }
  })
})

const lists: { oldList: any[]; newList: any[]; expectedOperations: ImmerOperation[] }[] = [
  {
    oldList: [1, 2, 3, 4, 5],
    newList: [1, 2, 4, 6, 8],
    expectedOperations: [
      { op: 'delete', path: [], index: 2 },
      { op: 'delete', path: [], index: 3 },
      { op: 'insert', path: [], index: 3, value: 6 },
      { op: 'insert', path: [], index: 4, value: 8 },
    ],
  },
  {
    oldList: [2, 4, 6, 8],
    newList: [1, 3, 5, 7],
    expectedOperations: [
      { op: 'delete', path: [], index: 0 },
      { op: 'delete', path: [], index: 0 },
      { op: 'delete', path: [], index: 0 },
      { op: 'delete', path: [], index: 0 },
      { op: 'insert', path: [], index: 0, value: 1 },
      { op: 'insert', path: [], index: 1, value: 3 },
      { op: 'insert', path: [], index: 2, value: 5 },
      { op: 'insert', path: [], index: 3, value: 7 },
    ],
  },
  {
    oldList: ['a', 'b', 'c', 'd'],
    newList: ['d', 'c', 'b', 'a'],
    expectedOperations: [
      { op: 'move', path: [], oldIndex: 3, newIndex: 0 },
      { op: 'move', path: [], oldIndex: 3, newIndex: 1 },
      { op: 'move', path: [], oldIndex: 3, newIndex: 2 },
    ],
  },
  {
    oldList: ['a', 'b', 'c', 'd'],
    newList: ['e', 'f', 'g', 'h'],
    expectedOperations: [
      { op: 'delete', path: [], index: 0 },
      { op: 'delete', path: [], index: 0 },
      { op: 'delete', path: [], index: 0 },
      { op: 'delete', path: [], index: 0 },
      { op: 'insert', path: [], index: 0, value: 'e' },
      { op: 'insert', path: [], index: 1, value: 'f' },
      { op: 'insert', path: [], index: 2, value: 'g' },
      { op: 'insert', path: [], index: 3, value: 'h' },
    ],
  },
  {
    oldList: ['a', 'b', 'c', 'd'],
    newList: ['a', 'b', 'c', 'd', 'e', 'f'],
    expectedOperations: [
      { op: 'insert', path: [], index: 4, value: 'e' },
      { op: 'insert', path: [], index: 5, value: 'f' },
    ],
  },
  {
    oldList: ['a', 'b', 'c', 'd', 'e', 'f'],
    newList: ['a', 'b', 'c', 'd'],
    expectedOperations: [
      { op: 'delete', path: [], index: 4 },
      { op: 'delete', path: [], index: 4 },
    ],
  },
  {
    oldList: ['a', 'b', 'c', 'd'],
    newList: ['a', 'b', 'd', 'e', 'f', 'c'],
    expectedOperations: [
      { op: 'move', path: [], oldIndex: 3, newIndex: 2 },
      { op: 'insert', path: [], index: 3, value: 'e' },
      { op: 'insert', path: [], index: 4, value: 'f' },
    ],
  },
  {
    oldList: ['a', 'b', 'c', 'd', 'e', 'f'],
    newList: ['f', 'e', 'd', 'c', 'b', 'a'],
    expectedOperations: [
      { op: 'move', path: [], oldIndex: 5, newIndex: 0 },
      { op: 'move', path: [], oldIndex: 5, newIndex: 1 },
      { op: 'move', path: [], oldIndex: 5, newIndex: 2 },
      { op: 'move', path: [], oldIndex: 5, newIndex: 3 },
      { op: 'move', path: [], oldIndex: 5, newIndex: 4 },
    ],
  },
  {
    oldList: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    newList: [1, 3, 5, 7, 9, 11],
    expectedOperations: [
      { op: 'delete', path: [], index: 1 },
      { op: 'delete', path: [], index: 2 },
      { op: 'delete', path: [], index: 3 },
      { op: 'delete', path: [], index: 4 },
      { op: 'delete', path: [], index: 5 },
      { op: 'insert', path: [], index: 5, value: 11 },
    ],
  },
  {
    oldList: [1, 3, 5, 7, 9, 11],
    newList: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    expectedOperations: [
      { op: 'insert', path: [], index: 1, value: 2 },
      { op: 'insert', path: [], index: 3, value: 4 },
      { op: 'insert', path: [], index: 5, value: 6 },
      { op: 'insert', path: [], index: 7, value: 8 },
      { op: 'delete', path: [], index: 9 },
      { op: 'insert', path: [], index: 9, value: 10 },
    ],
  },
  {
    oldList: ['apple', 'banana', 'orange', 'pear'],
    newList: ['apple', 'pineapple', 'grapefruit', 'pear'],
    expectedOperations: [
      { op: 'delete', path: [], index: 1 },
      { op: 'replace', path: [], index: 1, value: 'pineapple' },
      { op: 'insert', path: [], index: 2, value: 'grapefruit' },
    ],
  },
  {
    oldList: ['red', 'green', 'blue'],
    newList: ['red', 'purple', 'blue'],
    expectedOperations: [{ op: 'replace', path: [], index: 1, value: 'purple' }],
  },
  {
    oldList: [1, 2, 3, 4, 5],
    newList: [1, 6, 3, 7, 5],
    expectedOperations: [
      { op: 'replace', path: [], index: 1, value: 6 },
      { op: 'replace', path: [], index: 3, value: 7 },
    ],
  },
  {
    oldList: [
      '1',
      '711111111',
      '711',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '71111',
      '7111111111',
      '711111',
      '7111111111',
      '7',
      '7111111',
      '711',
      '3',
      '4',
      '5',
    ],
    newList: [
      '1',
      '7111111111',
      '711',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '71111',
      '7111111111',
      '711111',
      '7111111111',
      '7',
      '7111111',
      '711',
      '3',
      '4',
      '5',
    ],
    expectedOperations: [
      { op: 'delete', path: [], index: 1 },
      { op: 'move', path: [], oldIndex: 2, newIndex: 1 },
      { op: 'move', path: [], oldIndex: 4, newIndex: 3 },
      { op: 'move', path: [], oldIndex: 6, newIndex: 5 },
      { op: 'move', path: [], oldIndex: 8, newIndex: 7 },
      { op: 'move', path: [], oldIndex: 10, newIndex: 9 },
      { op: 'move', path: [], oldIndex: 12, newIndex: 11 },
      { op: 'move', path: [], oldIndex: 18, newIndex: 13 },
      { op: 'delete', path: [], index: 13 },
      { op: 'move', path: [], oldIndex: 17, newIndex: 13 },
      { op: 'delete', path: [], index: 13 },
      { op: 'move', path: [], oldIndex: 16, newIndex: 13 },
      { op: 'delete', path: [], index: 13 },
      { op: 'move', path: [], oldIndex: 15, newIndex: 13 },
      { op: 'delete', path: [], index: 13 },
      { op: 'move', path: [], oldIndex: 14, newIndex: 13 },
      { op: 'delete', path: [], index: 13 },
      { op: 'move', path: [], oldIndex: 13, newIndex: 13 },
      { op: 'delete', path: [], index: 13 },
      { op: 'insert', path: [], index: 13, value: '7111111111' },
      { op: 'insert', path: [], index: 14, value: '7' },
      { op: 'insert', path: [], index: 15, value: '7111111' },
      { op: 'insert', path: [], index: 16, value: '711' },
      { op: 'insert', path: [], index: 17, value: '3' },
      { op: 'insert', path: [], index: 18, value: '4' },
      { op: 'insert', path: [], index: 19, value: '5' },
    ],
  },
  {
    oldList: [
      '1',
      '7111111111',
      '711',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '71111',
      '7111111111',
      '711111',
      '7111111111',
      '7',
      '7111111',
      '711',
      '3',
      '4',
      '5',
    ],
    newList: [
      '1',
      '711111111',
      '711',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '711111',
      '7111111111',
      '71111',
      '7111111111',
      '711111',
      '7111111111',
      '7',
      '7111111',
      '711',
      '3',
      '4',
      '5',
    ],
    expectedOperations: [
      { op: 'insert', path: [], index: 1, value: '711111111' },
      { op: 'move', path: [], oldIndex: 3, newIndex: 2 },
      { op: 'move', path: [], oldIndex: 5, newIndex: 4 },
      { op: 'move', path: [], oldIndex: 7, newIndex: 6 },
      { op: 'move', path: [], oldIndex: 9, newIndex: 8 },
      { op: 'move', path: [], oldIndex: 11, newIndex: 10 },
      { op: 'move', path: [], oldIndex: 13, newIndex: 12 },
      { op: 'move', path: [], oldIndex: 15, newIndex: 14 },
      { op: 'move', path: [], oldIndex: 16, newIndex: 15 },
      { op: 'move', path: [], oldIndex: 17, newIndex: 16 },
      { op: 'move', path: [], oldIndex: 18, newIndex: 17 },
      { op: 'move', path: [], oldIndex: 19, newIndex: 18 },
      { op: 'move', path: [], oldIndex: 20, newIndex: 19 },
      { op: 'delete', path: [], index: 20 },
    ],
  },
]
