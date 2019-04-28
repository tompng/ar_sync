export { useArSyncFetch } from '../hooksBase'
import { useArSyncModelWithClass, Request, DataAndStatus } from '../hooksBase'
import ArSyncModel from './ArSyncModel'

export function useArSyncModel<T>(request: Request | null): DataAndStatus<T> {
  return useArSyncModelWithClass<T>(ArSyncModel, request)
}
