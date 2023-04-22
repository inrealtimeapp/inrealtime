import {
  DocumentInsertRequest,
  DocumentOperationInsert,
  DocumentOperationMove,
  DocumentOperationReplace,
  DocumentOperationRequest,
  DocumentOperationResponse,
} from '../../../../core'

export const minifyOperations = (
  operations: (DocumentOperationRequest | DocumentOperationResponse)[],
) => {
  // Minify to only required operations
  let minifiedOperations: (DocumentOperationRequest | DocumentOperationResponse)[] = []
  for (const operation of operations) {
    switch (operation.op) {
      case 'root':
        // If setting root we can remove all previous operations as they won't matter
        minifiedOperations = [operation]
        break
      case 'insert':
        {
          minifiedOperations.push(operation)
        }
        break
      case 'replace':
        {
          // Filter out previous replaces of the same fragment
          minifiedOperations = minifiedOperations.filter(
            (opr) => !(opr.op === DocumentOperationReplace && opr.id === operation.id),
          )
          minifiedOperations.push(operation)
        }
        break
      case 'delete':
        {
          // Find last insert with same id as delete
          const lastInsertIndex = minifiedOperations
            .map((opr) => opr.op === DocumentOperationInsert && opr.value.id === operation.id)
            .lastIndexOf(true)

          // The reason this fails, is because the indexes change!
          if (lastInsertIndex > 0) {
            const removedInsert = minifiedOperations[lastInsertIndex] as DocumentInsertRequest

            // If the removed is inside a list then we can only discard the insert and delete if they are right next to each other
            // If we don't check for this, we may get issues where discarded operations affect other operations that occurred in between the insert and delete, and their indexes are off
            if (
              removedInsert.parentListIndex !== undefined &&
              lastInsertIndex !== minifiedOperations.length - 1
            ) {
              minifiedOperations.push(operation)
            } else {
              // If we have an insert with the same id, remove it instead of inserting then deleting
              minifiedOperations.splice(lastInsertIndex, 1)
            }
          } else {
            minifiedOperations.push(operation)
          }
        }
        break
      case 'move':
        {
          // If last operation is a move with the same id, replace it
          if (minifiedOperations.length > 0) {
            const lastOp = minifiedOperations[minifiedOperations.length - 1]
            if (lastOp.op === DocumentOperationMove && lastOp.id === operation.id) {
              minifiedOperations[minifiedOperations.length - 1] = operation
              break
            }
          }

          minifiedOperations.push(operation)
        }
        break
    }
  }
  return minifiedOperations
}
