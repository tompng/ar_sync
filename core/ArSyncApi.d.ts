declare function apiBatchFetch(endpoint: string, requests: object[]): Promise<any>;
declare const ArSyncApi: {
    domain: string | null;
    _batchFetch: typeof apiBatchFetch;
    fetch: (request: object) => Promise<{}>;
    syncFetch: (request: object) => Promise<{}>;
};
export default ArSyncApi;
