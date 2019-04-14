export default class ArSyncStore {
    immutable: any;
    markedForFreezeObjects: any;
    changes: any;
    eventListeners: any;
    markForRelease: any;
    container: any;
    data: any;
    loaded: any;
    changesBufferTimer: any;
    static connectionManager: any;
    constructor(request: any, { immutable }?: {
        immutable?: boolean | undefined;
    });
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
