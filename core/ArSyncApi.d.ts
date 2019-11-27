declare function apiBatchFetch(endpoint: string, requests: object[]): Promise<any>;
declare const ArSyncApi: {
    domain: string | null;
    _batchFetch: typeof apiBatchFetch;
    fetch: (request: object) => Promise<unknown>;
    syncFetch: (request: object) => Promise<unknown>;
};
export default ArSyncApi;
