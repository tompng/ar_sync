export declare type Request = {
    api: string;
    query: any;
    params?: any;
    id?: IDType;
};
declare type IDType = number | string;
export declare class ArSyncStore {
    immutable: boolean;
    markedForFreezeObjects: any[];
    changes: any;
    eventListeners: any;
    markForRelease: true | undefined;
    container: any;
    request: Request;
    complete: boolean;
    notfound?: boolean;
    destroyed: boolean;
    data: any;
    changesBufferTimer: number | undefined | null;
    retryLoadTimer: number | undefined | null;
    static connectionManager: any;
    constructor(request: Request, { immutable }?: {
        immutable?: boolean | undefined;
    });
    handleDestroy(): void;
    load(retryCount: number): void;
    setChangesBufferTimer(): void;
    subscribe(event: any, callback: any): {
        unsubscribe: () => void;
    };
    trigger(event: any, arg?: any): void;
    mark(object: any): void;
    freezeRecursive(obj: any): any;
    freezeMarked(): void;
    release(): void;
}
export {};
