export type Versions = {
  [key: string]: number
}

export type UseVersions = {
  (): Versions
  <TRealtimeSubState = Versions>(
    selector: (versions: Versions) => TRealtimeSubState,
    equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean,
  ): TRealtimeSubState
}
export type SubscribeVersions = <TRealtimeSubState>(
  selector: (versions: Versions) => TRealtimeSubState,
  listener: (selectedState: TRealtimeSubState, previousSelectedState: TRealtimeSubState) => void,
  options?:
    | {
        equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean
        fireImmediately?: boolean
      }
    | undefined,
) => () => void

export type VersionsPatch = ({}: { versions: Versions }) => Versions

export type VersionsStore = {
  useStore: UseVersions
  subscribe: SubscribeVersions
  patch: (fn: VersionsPatch) => void
  reset: () => void
}
