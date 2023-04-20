import { Fragment } from '../../../../core'

export const Debug: {
  debugListFragmentIndexes: boolean
  debugLocalOperations: boolean
  debugRemoteOperations: boolean
} = {
  debugListFragmentIndexes: false,
  debugLocalOperations: false,
  debugRemoteOperations: false,
}

export const debugListFragmentIndexes = (listFragment: Fragment, extraInfo: string) => {
  // Debug that indexes are not correct
  const allListItems = Object.values(listFragment.value)
  const allListItemsIndexes = allListItems.map((item) => item.parentListIndex!)
  if (allListItemsIndexes.length !== new Set(allListItemsIndexes).size) {
    console.warn(`List fragment indexes are not unique. ${allListItemsIndexes}`, extraInfo)
  }
  const expectedIndexes = Array.from({ length: allListItems.length }, (_, i) => i)
  for (const expectedIndex of expectedIndexes) {
    if (!allListItemsIndexes.includes(expectedIndex)) {
      console.warn(
        `List fragment indexes are not correct. Missing index: ${expectedIndex}.`,
        extraInfo,
      )
    }
  }
}
