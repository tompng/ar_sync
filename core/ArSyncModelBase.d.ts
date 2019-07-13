interface Request {
    field: string;
    params?: any;
    query?: any;
}
declare type Path = (string | number)[];
interface Change {
    path: Path;
    value: any;
}
declare type ChangeCallback = (change: Change) => void;
declare type LoadCallback = () => void;
declare type ConnectionCallback = (status: boolean) => void;
declare type SubscriptionType = 'load' | 'change' | 'connection';
declare type SubscriptionCallback = ChangeCallback | LoadCallback | ConnectionCallback;
interface Adapter {
    subscribe: (key: string, received: (data: any) => void) => {
        unsubscribe: () => void;
    };
    ondisconnect: () => void;
    onreconnect: () => void;
}
export default abstract class ArSyncModelBase<T> {
    private _ref;
    private _listenerSerial;
    private _listeners;
    complete: boolean;
    notfound?: boolean;
    connected: boolean;
    data: T | null;
    static _cache: {
        [key: string]: {
            key: string;
            count: number;
            timer: number | null;
            model: any;
        };
    };
    static cacheTimeout: number;
    abstract refManagerClass(): any;
    abstract connectionManager(): {
        networkStatus: boolean;
    };
    constructor(request: Request, option?: {
        immutable: boolean;
    });
    onload(callback: LoadCallback): void;
    subscribeOnce(event: SubscriptionType, callback: SubscriptionCallback): {
        unsubscribe: () => void;
    };
    subscribe(event: SubscriptionType, callback: SubscriptionCallback): {
        unsubscribe: () => void;
    };
    release(): void;
    static retrieveRef(request: Request, option?: {
        immutable: boolean;
    }): {
        key: string;
        count: number;
        timer: number | null;
        model: any;
    };
    static createRefModel(_request: Request, _option?: {
        immutable: boolean;
    }): void;
    static _detach(ref: any): void;
    private static _attach;
    static setConnectionAdapter(_adapter: Adapter): void;
    static waitForLoad(...models: ArSyncModelBase<{}>[]): Promise<unknown>;
}
export {};
