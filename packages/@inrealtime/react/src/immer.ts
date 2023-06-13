import { current, original } from 'immer'

export const realtimeOriginal = <T>(value: T): T | undefined => {
  return original(value)
}

export const realtimeCurrent = <T>(value: T): T => {
  return current(value)
}
