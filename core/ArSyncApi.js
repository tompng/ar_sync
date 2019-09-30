"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function apiBatchFetch(endpoint, requests) {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
    const body = JSON.stringify({ requests });
    const option = { credentials: 'include', method: 'POST', headers, body };
    if (ArSyncApi.domain)
        endpoint = ArSyncApi.domain + endpoint;
    const res = await fetch(endpoint, option);
    if (res.status === 200)
        return res.json();
    throw new Error(res.statusText);
}
class ApiFetcher {
    constructor(endpoint) {
        this.batches = [];
        this.batchFetchTimer = null;
        this.endpoint = endpoint;
    }
    fetch(request) {
        return new Promise((resolve, reject) => {
            this.batches.push([request, { resolve, reject }]);
            if (this.batchFetchTimer)
                return;
            this.batchFetchTimer = setTimeout(() => {
                this.batchFetchTimer = null;
                const compacts = {};
                const requests = [];
                const callbacksList = [];
                for (const batch of this.batches) {
                    const request = batch[0];
                    const callback = batch[1];
                    const key = JSON.stringify(request);
                    if (compacts[key]) {
                        compacts[key].push(callback);
                    }
                    else {
                        requests.push(request);
                        callbacksList.push(compacts[key] = [callback]);
                    }
                }
                this.batches = [];
                ArSyncApi._batchFetch(this.endpoint, requests).then((results) => {
                    for (const i in callbacksList) {
                        const result = results[i];
                        const callbacks = callbacksList[i];
                        for (const callback of callbacks) {
                            if (result.data) {
                                callback.resolve(result.data);
                            }
                            else {
                                const error = result.error || { type: 'Unknown Error' };
                                callback.reject(Object.assign({}, error, { retry: false }));
                            }
                        }
                    }
                }).catch(e => {
                    const error = { type: e.name, message: e.message, retry: true };
                    for (const callbacks of callbacksList) {
                        for (const callback of callbacks)
                            callback.reject(error);
                    }
                });
            }, 16);
        });
    }
}
const staticFetcher = new ApiFetcher('/static_api');
const syncFetcher = new ApiFetcher('/sync_api');
const ArSyncApi = {
    domain: null,
    _batchFetch: apiBatchFetch,
    fetch: (request) => staticFetcher.fetch(request),
    syncFetch: (request) => syncFetcher.fetch(request),
};
exports.default = ArSyncApi;
