import ArSyncModelBase from '../core/ArSyncModelBase';
import ConnectionAdapter from '../core/ConnectionAdapter';
declare class ArSyncRecord {
    immutable: any;
    request: any;
    subscriptions: any;
    store: any;
    retryLoadTimer: any;
    data: any;
    bufferTimer: any;
    bufferedPatches: any;
    eventListeners: any;
    networkSubscription: any;
    complete: boolean;
    notfound?: boolean;
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
    static setConnectionAdapter(adapter: ConnectionAdapter): void;
    static createRefModel(request: any, option: any): ArSyncRecord;
    refManagerClass(): typeof ArSyncModel;
    connectionManager(): any;
    static _cache: {};
    static cacheTimeout: number;
}
export {};
