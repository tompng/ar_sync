declare function apiBatchFetch(endpoint: string, requests: object[]): Promise<any>;
declare type Request = {
    api: string;
    params?: any;
    query: any;
    id?: number;
};
declare const ArSyncApi: {
    domain: string | null;
    _batchFetch: typeof apiBatchFetch;
    fetch: (request: Request) => Promise<unknown>;
    syncFetch: (request: Request) => Promise<unknown>;
};
export default ArSyncApi;
