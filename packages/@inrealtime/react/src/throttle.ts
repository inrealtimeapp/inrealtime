const DefaultThrottle = 50
const MinThrottle = 15
const MaxThrottle = 2000

export const getThrottle = (throttle?: number): number => {
  if (throttle === undefined) {
    return DefaultThrottle
  }
  if (throttle < MinThrottle || throttle > MaxThrottle) {
    console.warn(
      `Throttle must be between '${MinThrottle}' and '${MaxThrottle}'. Defaulted to '${DefaultThrottle}'`,
    )
    return DefaultThrottle
  }
  return throttle
}
