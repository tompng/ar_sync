import ArSyncModelBase from '../ArSyncModelBase';
declare class ArSyncRecord {
    immutable: any;
    request: any;
    subscriptions: any;
    store: any;
    loaded: any;
    retryLoadTimer: any;
    data: any;
    bufferTimer: any;
    bufferedPatches: any;
    eventListeners: any;
    networkSubscription: any;
    static connectionManager: any;
    constructor(request: any, option?: {
        immutable?: boolean | undefined;
    });
    release(): void;
    unsubscribeAll(): void;
    load(callback: any, retryCount?: number): void;
    retryLoad(callback: any, retryCount: any): void;
    patchReceived(patch: any): void;
    subscribe(event: any, callback: any): {
        unsubscribe: () => void;
    };
    trigger(event: any, arg?: any): void;
    initializeStore(keys: any, data: any, option: any): void;
}
export default class ArSyncModel<T> extends ArSyncModelBase<T> {
    static setConnectionAdapter(adapter: any): void;
    static createRefModel(request: any, option: any): ArSyncRecord;
    refManagerClass(): typeof ArSyncModel;
    static _cache: {};
    static cacheTimeout: number;
}
export {};
