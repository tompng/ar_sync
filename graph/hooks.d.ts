export { useArSyncFetch } from '../core/hooksBase';
import { Request, DataAndStatus } from '../core/hooksBase';
export declare function useArSyncModel<T>(request: Request | null): DataAndStatus<T>;
