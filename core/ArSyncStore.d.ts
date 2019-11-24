export default class ArSyncStore {
    immutable: boolean;
    markedForFreezeObjects: any[];
    changes: any;
    eventListeners: any;
    markForRelease: true | undefined;
    container: any;
    request: any;
    complete: boolean;
    notfound?: boolean;
    data: any;
    changesBufferTimer: number | undefined | null;
    retryLoadTimer: number | undefined | null;
    static connectionManager: any;
    constructor(request: any, { immutable }?: {
        immutable?: boolean | undefined;
    });
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
