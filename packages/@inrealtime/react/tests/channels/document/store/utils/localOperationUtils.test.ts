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
          { op: 'replace', path: ['list'], index: 3, value: 6 },
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
