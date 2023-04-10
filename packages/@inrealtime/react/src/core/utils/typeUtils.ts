export const clone = <T>(obj: T): T => {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map((a) => clone(a)) as any
    } else if ((obj as any).constructor === Object) {
      return Object.entries(obj).reduce((prev, [k, v]) => ({ ...prev, [k]: clone(v) }), {}) as any
    }

    return obj
  }

  return obj
}

export const isMap = (value: any) => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Array) &&
    !(value instanceof Date)
  )
}

export const isList = (value: any) => {
  return Array.isArray(value)
}

export const isNumber = (value: any) => {
  return Number(value) === value
}

export const isString = (value: any) => {
  return typeof value === 'string' || value instanceof String
}

export const isBoolean = (value: any) => {
  return typeof value === 'boolean'
}

export const listsShallowEqual = (a: any[], b: any[]): boolean => {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Check if list b starts with list a.
 * a=[1,2,3], b=[1,2,3,4,5] would return true
 * a=[1,2,3], b=[1,2] would return false
 */
export const listsShallowStartsWith = (a: any[], b: any[]): boolean => {
  if (a === b) return true
  if (a == null || b == null) return false

  if (a.length > b.length) return false

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}
