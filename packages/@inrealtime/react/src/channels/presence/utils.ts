import { isMap } from '../../core'

export const mergeData = (oldData: any, newData: any) => {
  // Replace data only if either data is undefined or either data isn't a map
  if (oldData === undefined || newData == undefined || !isMap(oldData) || !isMap(newData)) {
    return newData
  } else {
    // Otherwise merge them
    return { ...oldData, ...newData }
  }
}
