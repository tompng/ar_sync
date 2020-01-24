declare let useState: <T>(t: T | (() => T)) => [T, (t: T | ((t: T) => T)) => void];
declare let useEffect: (f: (() => void) | (() => (() => void)), deps: any[]) => void;
declare let useMemo: <T>(f: () => T, deps: any[]) => T;
declare let useRef: <T>(value: T) => {
    current: T;
};
declare type InitializeHooksParams = {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
};
export declare function initializeHooks(hooks: InitializeHooksParams): void;
interface ModelStatus {
    complete: boolean;
    notfound?: boolean;
    connected: boolean;
}
export declare type DataAndStatus<T> = [T | null, ModelStatus];
export interface Request {
    api: string;
    params?: any;
    query: any;
}
export declare function useArSyncModel<T>(request: Request | null): DataAndStatus<T>;
interface FetchStatus {
    complete: boolean;
    notfound?: boolean;
}
declare type DataStatusUpdate<T> = [T | null, FetchStatus, () => void];
export declare function useArSyncFetch<T>(request: Request | null): DataStatusUpdate<T>;
export {};
