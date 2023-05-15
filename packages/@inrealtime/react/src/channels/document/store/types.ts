import { DocumentOperationsRequest, DocumentOperationsResponse, Fragment } from '../../../core'
import { FragmentIdToPath, ImmerPath } from './utils/pathUtils'

export type UseStore<TRealtimeState> = {
  (): TRealtimeState
  <TRealtimeSubState>(
    selector: (root: TRealtimeState) => TRealtimeSubState,
    equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean,
  ): TRealtimeSubState
}

export type Patch<TRealtimeState> = (fn: DocumentPatch<TRealtimeState>) => void

export type Subscribe<TRealtimeState> = <TRealtimeSubState>(
  selector: (state: TRealtimeState) => TRealtimeSubState,
  listener: (selectedState: TRealtimeSubState, previousSelectedState: TRealtimeSubState) => void,
  options?:
    | {
        equalityFn?: (a: TRealtimeSubState, b: TRealtimeSubState) => boolean
        fireImmediately?: boolean
      }
    | undefined,
) => () => void

export type DocumentPatch<TRealtimeState> = (root: TRealtimeState) => TRealtimeState | void

export type RealtimeStore<TRealtimeState> = {
  getName(): string
  getRoot(): { document: TRealtimeState; fragment: Fragment; fragmentIdToPath: FragmentIdToPath }
  setRoot({}: {
    document: TRealtimeState | undefined
    fragment: Fragment | undefined
    fragmentIdToPath: FragmentIdToPath | undefined
  }): void
  useStore: UseStore<TRealtimeState>
  patch: Patch<TRealtimeState>
  subscribe: Subscribe<TRealtimeState>
  applyRemoteOperations(messages: (DocumentOperationsResponse | DocumentOperationsRequest)[]): void
  resolveConflicts(conflictFragmentIds: string[], truthStore: RealtimeStore<TRealtimeState>): void
}

export type ImmerOperation =
  | { op: 'root'; path: ImmerPath; value: any }
  | { op: 'insert' | 'replace'; path: ImmerPath; index: string | number; value: any }
  | { op: 'move'; path: ImmerPath; oldIndex: number; newIndex: number }
  | { op: 'delete'; path: ImmerPath; index: string | number }
