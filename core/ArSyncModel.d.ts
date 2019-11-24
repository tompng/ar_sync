import ConnectionAdapter from './ConnectionAdapter';
interface Request {
    api: string;
    query: any;
    params?: any;
}
declare type Path = Readonly<(string | number)[]>;
interface Change {
    path: Path;
    value: any;
}
declare type ChangeCallback = (change: Change) => void;
declare type LoadCallback = () => void;
declare type ConnectionCallback = (status: boolean) => void;
declare type SubscriptionType = 'load' | 'change' | 'connection';
declare type SubscriptionCallback = ChangeCallback | LoadCallback | ConnectionCallback;
declare type PathFirst<P extends Readonly<any[]>> = ((...args: P) => void) extends (first: infer First, ...other: any) => void ? First : never;
declare type PathRest<U> = U extends Readonly<any[]> ? ((...args: U) => any) extends (head: any, ...args: infer T) => any ? U extends Readonly<[any, any, ...any[]]> ? T : never : never : never;
declare type DigResult<Data, P extends Readonly<any[]>> = Data extends null | undefined ? Data : PathFirst<P> extends never ? Data : PathFirst<P> extends keyof Data ? (Data extends Readonly<any[]> ? undefined : never) | {
    0: Data[PathFirst<P>];
    1: DigResult<Data[PathFirst<P>], PathRest<P>>;
}[PathRest<P> extends never ? 0 : 1] : undefined;
export default class ArSyncModel<T> {
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
    constructor(request: Request, option?: {
        immutable: boolean;
    });
    onload(callback: LoadCallback): void;
    subscribeOnce(event: SubscriptionType, callback: SubscriptionCallback): {
        unsubscribe: () => void;
    };
    dig<P extends Path>(path: P): DigResult<T, P> | null;
    static digData<Data, P extends Path>(data: Data, path: P): DigResult<Data, P>;
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
    static _detach(ref: any): void;
    private static _attach;
    static setConnectionAdapter(adapter: ConnectionAdapter): void;
    static waitForLoad(...models: ArSyncModel<{}>[]): Promise<{}>;
}
export {};
