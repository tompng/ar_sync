export { useArSyncFetch } from '../hooksBase';
import { Request, DataAndStatus } from '../hooksBase';
export declare function useArSyncModel<T>(request: Request | null): DataAndStatus<T>;
