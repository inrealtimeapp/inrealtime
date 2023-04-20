import { Fragment, isList, isMap } from '../../../../core'
import { FragmentIdToPath } from '../utils/pathUtils'

/**
 * Format an object (i.e. remove nulls, sort keys, etc) for equality comparison
 */
const getFormattedObj = (d: any) => {
  if (isList(d)) {
    return d.map((d1: any) => getFormattedObj(d1))
  }
  const newObject: any = {}
  Object.keys(d)
    .sort()
    .forEach(function (key, i) {
      if (d[key] === undefined || d[key] === null) {
        return
      }

      if (isList(d[key]) || isMap(d[key])) {
        newObject[key] = getFormattedObj(d[key])
        return
      }

      newObject[key] = d[key]
    })
  return newObject
}

export const areStoresEqual = <TRealtimeState>(
  d1: { document: TRealtimeState; fragment: Fragment; fragmentIdToPath: FragmentIdToPath },
  d2: { document: TRealtimeState; fragment: Fragment; fragmentIdToPath: FragmentIdToPath },
): { documentsEqual: boolean; fragmentsEqual: boolean; fragmentIdToPathsEqual: boolean } => {
  return {
    documentsEqual:
      JSON.stringify(getFormattedObj(d1.document)) === JSON.stringify(getFormattedObj(d2.document)),
    fragmentsEqual:
      JSON.stringify(getFormattedObj(d1.fragment)) === JSON.stringify(getFormattedObj(d2.fragment)),
    fragmentIdToPathsEqual:
      JSON.stringify(getFormattedObj(d1.fragmentIdToPath)) ===
      JSON.stringify(getFormattedObj(d2.fragmentIdToPath)),
  }
}
