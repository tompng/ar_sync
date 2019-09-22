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
interface ArSyncModel<T> {
    data: T | null;
    complete: boolean;
    connected: boolean;
    notfound?: boolean;
    release(): void;
    subscribe(type: any, callback: any): any;
}
export declare function useArSyncModelWithClass<T>(modelClass: {
    new <T>(req: Request, option?: any): ArSyncModel<T>;
}, request: Request | null): DataAndStatus<T>;
interface FetchStatus {
    complete: boolean;
    notfound?: boolean;
}
declare type DataStatusUpdate<T> = [T | null, FetchStatus, () => void];
export declare function useArSyncFetch<T>(request: Request | null): DataStatusUpdate<T>;
export {};
