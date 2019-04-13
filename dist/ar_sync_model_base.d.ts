interface Request {
    api: string;
    query: any;
    params?: any;
}
declare type Path = (string | number)[];
interface Change {
    path: Path;
    value: any;
}
declare type ChangeCallback = (change: Change) => void;
declare type LoadCallback = () => void;
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
    data: T | {} | undefined;
    loaded: boolean | undefined;
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
    constructor(request: Request, option?: {
        immutable: boolean;
    });
    onload(callback: LoadCallback): void;
    subscribeOnce(event: 'load' | 'change', callback: LoadCallback | ChangeCallback): {
        unsubscribe: () => void;
    };
    subscribe(event: 'load' | 'change', callback: LoadCallback | ChangeCallback): {
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
    static waitForLoad(...models: ArSyncModelBase<{}>[]): Promise<{}>;
}
export {};
