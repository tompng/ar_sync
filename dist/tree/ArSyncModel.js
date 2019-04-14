"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ArSyncStore_1 = require("./ArSyncStore");
const ArSyncApi_1 = require("../ArSyncApi");
const ConnectionManager_1 = require("../ConnectionManager");
const ArSyncModelBase_1 = require("../ArSyncModelBase");
class ArSyncRecord {
    constructor(request, option = {}) {
        this.immutable = option.immutable ? true : false;
        this.request = request;
        this.subscriptions = [];
        this.store = null;
        this.data = {};
        this.bufferedPatches = [];
        this.eventListeners = { events: {}, serial: 0 };
        this.networkSubscription = ArSyncRecord.connectionManager.subscribeNetwork((status) => {
            if (status) {
                this.load(() => {
                    this.trigger('reconnect');
                    this.trigger('change', { path: [], value: this.data });
                });
            }
            else {
                this.unsubscribeAll();
                this.trigger('disconnect');
            }
        });
        this.load(() => {
            this.loaded = true;
            this.trigger('load');
            this.trigger('change', { path: [], value: this.data });
        });
    }
    release() {
        this.unsubscribeAll();
        this.networkSubscription.unsubscribe();
    }
    unsubscribeAll() {
        if (this.retryLoadTimer)
            clearTimeout(this.retryLoadTimer);
        for (const s of this.subscriptions)
            s.unsubscribe();
        this.subscriptions = [];
    }
    load(callback, retryCount = 0) {
        ArSyncApi_1.default.syncFetch(this.request).then(syncData => {
            const { keys, data, limit, order } = syncData;
            this.initializeStore(keys, data, { limit, order, immutable: this.immutable });
            if (callback)
                callback(this.data);
        }).catch(e => {
            console.error(e);
            if (e.retry) {
                this.retryLoad(callback, retryCount + 1);
            }
            else {
                this.initializeStore([], {}, { immutable: this.immutable });
                if (callback)
                    callback(this.data);
            }
        });
    }
    retryLoad(callback, retryCount) {
        const sleepSeconds = Math.min(Math.pow(2, retryCount), 30);
        this.retryLoadTimer = setTimeout(() => {
            this.retryLoadTimer = null;
            this.load(callback, retryCount);
        }, sleepSeconds * 1000);
    }
    patchReceived(patch) {
        const buffer = this.bufferedPatches;
        buffer.push(patch);
        if (this.bufferTimer)
            return;
        this.bufferTimer = setTimeout(() => {
            this.bufferTimer = null;
            this.bufferedPatches;
            const buf = this.bufferedPatches;
            this.bufferedPatches = [];
            const { changes, events } = this.store.batchUpdate(buf);
            this.data = this.store.data;
            changes.forEach(change => this.trigger('change', change));
            events.forEach(event => {
                this.trigger(event.type, event.data);
            });
        }, 16);
    }
    subscribe(event, callback) {
        let listeners = this.eventListeners.events[event];
        if (!listeners)
            this.eventListeners.events[event] = listeners = {};
        const id = this.eventListeners.serial++;
        listeners[id] = callback;
        return { unsubscribe: () => { delete listeners[id]; } };
    }
    trigger(event, arg) {
        const listeners = this.eventListeners.events[event];
        if (!listeners)
            return;
        for (const id in listeners)
            listeners[id](arg);
    }
    initializeStore(keys, data, option) {
        const query = this.request.query;
        if (this.store) {
            this.store.replaceData(data);
        }
        else {
            this.store = new ArSyncStore_1.default(query, data, option);
            this.data = this.store.data;
        }
        this.subscriptions = keys.map(key => {
            return ArSyncRecord.connectionManager.subscribe(key, patch => this.patchReceived(patch));
        });
    }
}
class ArSyncModel extends ArSyncModelBase_1.default {
    static setConnectionAdapter(adapter) {
        ArSyncRecord.connectionManager = new ConnectionManager_1.default(adapter);
    }
    static createRefModel(request, option) {
        return new ArSyncRecord(request, option);
    }
    refManagerClass() {
        return ArSyncModel;
    }
}
ArSyncModel._cache = {};
ArSyncModel.cacheTimeout = 10 * 1000;
exports.default = ArSyncModel;
