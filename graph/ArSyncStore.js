"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ArSyncApi_1 = require("../core/ArSyncApi");
const parseRequest_1 = require("../core/parseRequest");
const ModelBatchRequest = {
    timer: null,
    apiRequests: {},
    fetch(field, query, id) {
        this.setTimer();
        return new Promise(resolve => {
            const queryJSON = JSON.stringify(query);
            const apiRequest = this.apiRequests[field] = this.apiRequests[field] || {};
            const queryRequests = apiRequest[queryJSON] = apiRequest[queryJSON] || { query, requests: {} };
            const request = queryRequests.requests[id] = queryRequests.requests[id] || { id, callbacks: [] };
            request.callbacks.push(resolve);
        });
    },
    batchFetch() {
        const { apiRequests } = this;
        for (const field in apiRequests) {
            const apiRequest = apiRequests[field];
            for (const { query, requests } of Object.values(apiRequest)) {
                const ids = Object.values(requests).map(({ id }) => id);
                ArSyncApi_1.default.syncFetch({ field, query, params: { ids } }).then((models) => {
                    for (const model of models)
                        requests[model.id].model = model;
                    for (const { model, callbacks } of Object.values(requests)) {
                        for (const callback of callbacks)
                            callback(model);
                    }
                });
            }
        }
        this.apiRequests = {};
    },
    setTimer() {
        if (this.timer)
            return;
        this.timer = setTimeout(() => {
            this.timer = null;
            this.batchFetch();
        }, 20);
    }
};
class ArSyncContainerBase {
    constructor() {
        this.listeners = [];
    }
    replaceData(_data, _sync_keys) { }
    initForReload(request) {
        this.networkSubscriber = ArSyncStore.connectionManager.subscribeNetwork((state) => {
            if (state) {
                ArSyncApi_1.default.syncFetch(request).then(data => {
                    if (this.data) {
                        this.replaceData(data);
                        if (this.onConnectionChange)
                            this.onConnectionChange(true);
                        if (this.onChange)
                            this.onChange([], this.data);
                    }
                });
            }
            else {
                if (this.onConnectionChange)
                    this.onConnectionChange(false);
            }
        });
    }
    release() {
        if (this.networkSubscriber)
            this.networkSubscriber.unsubscribe();
        this.unsubscribeAll();
        for (const child of Object.values(this.children)) {
            if (child)
                child.release();
        }
        this.data = null;
    }
    onChange(path, data) {
        if (this.parentModel)
            this.parentModel.onChange([this.parentKey, ...path], data);
    }
    subscribe(key, listener) {
        this.listeners.push(ArSyncStore.connectionManager.subscribe(key, listener));
    }
    unsubscribeAll() {
        for (const l of this.listeners)
            l.unsubscribe();
        this.listeners = [];
    }
    static _load({ field, id, params, query }, root) {
        const parsedQuery = parseRequest_1.parseRequest(query, true);
        if (id) {
            return ModelBatchRequest.fetch(field, query, id).then(data => new ArSyncRecord(parsedQuery, data[0], null, root));
        }
        else {
            const request = { field, query, params };
            return ArSyncApi_1.default.syncFetch(request).then((response) => {
                if (response.collection && response.order) {
                    return new ArSyncCollection(response.sync_keys, 'collection', parsedQuery, params, response, request, root);
                }
                else {
                    return new ArSyncRecord(parsedQuery, response, request, root);
                }
            });
        }
    }
    static load(apiParams, root) {
        if (!(apiParams instanceof Array))
            return this._load(apiParams, root);
        return new Promise((resolve, _reject) => {
            const resultModels = [];
            let countdown = apiParams.length;
            apiParams.forEach((param, i) => {
                this._load(param, root).then(model => {
                    resultModels[i] = model;
                    countdown--;
                    if (countdown === 0)
                        resolve(resultModels);
                });
            });
        });
    }
}
class ArSyncRecord extends ArSyncContainerBase {
    constructor(query, data, initialRequest, root) {
        super();
        this.root = root;
        if (initialRequest)
            this.initForReload(initialRequest);
        this.query = query;
        this.data = {};
        this.children = {};
        this.replaceData(data);
    }
    setSyncKeys(sync_keys) {
        this.sync_keys = sync_keys;
        if (!this.sync_keys) {
            this.sync_keys = [];
        }
    }
    replaceData(data) {
        this.setSyncKeys(data.sync_keys);
        this.unsubscribeAll();
        if (this.data.id !== data.id) {
            this.mark();
            this.data.id = data.id;
        }
        this.paths = [];
        for (const key in this.query) {
            const queryField = this.query[key];
            const aliasName = queryField.field || key;
            const subData = data[key];
            if (key === 'sync_keys')
                continue;
            if (queryField.query && (subData instanceof Array || (subData && subData.collection && subData.order))) {
                if (this.children[key]) {
                    this.children[key].replaceData(subData, this.sync_keys);
                }
                else {
                    const collection = new ArSyncCollection(this.sync_keys, aliasName, queryField.query, queryField.params, subData, null, this.root);
                    this.mark();
                    this.children[key] = collection;
                    this.data[key] = collection.data;
                    collection.parentModel = this;
                    collection.parentKey = key;
                }
            }
            else {
                if (queryField.query && Object.keys(queryField.query).length > 0)
                    this.paths.push(key);
                if (subData && subData.sync_keys) {
                    if (this.children[key]) {
                        this.children[key].replaceData(subData);
                    }
                    else {
                        const model = new ArSyncRecord(queryField.query, subData, null, this.root);
                        this.mark();
                        this.children[key] = model;
                        this.data[key] = model.data;
                        model.parentModel = this;
                        model.parentKey = key;
                    }
                }
                else {
                    if (this.children[key]) {
                        this.children[key].release();
                        delete this.children[key];
                    }
                    if (this.data[key] !== subData) {
                        this.mark();
                        this.data[key] = subData;
                    }
                }
            }
        }
        if (this.query.attributes['*']) {
            for (const key in data) {
                if (!this.query.attributes[key] && this.data[key] !== data[key]) {
                    this.mark();
                    this.data[key] = data[key];
                }
            }
        }
        this.subscribeAll();
    }
    onNotify(notifyData, path) {
        const { action, class_name, id } = notifyData;
        if (action === 'remove') {
            this.children[path].release();
            this.children[path] = null;
            this.mark();
            this.data[path] = null;
            this.onChange([path], null);
        }
        else if (action === 'add') {
            if (this.data.id === id)
                return;
            const query = this.query[path].query;
            ModelBatchRequest.fetch(class_name, query, id).then(data => {
                if (!data)
                    return;
                const model = new ArSyncRecord(query, data, null, this.root);
                if (this.children[path])
                    this.children[path].release();
                this.children[path] = model;
                this.mark();
                this.data[path] = model.data;
                model.parentModel = this;
                model.parentKey = path;
                this.onChange([path], model.data);
            });
        }
        else {
            ModelBatchRequest.fetch(class_name, this.reloadQuery(), id).then(data => {
                this.update(data);
            });
        }
    }
    subscribeAll() {
        const callback = data => this.onNotify(data);
        for (const key of this.sync_keys) {
            this.subscribe(key, callback);
        }
        for (const path of this.paths) {
            const pathCallback = data => this.onNotify(data, path);
            for (const key of this.sync_keys)
                this.subscribe(key + path, pathCallback);
        }
    }
    reloadQuery() {
        if (this.reloadQueryCache)
            return this.reloadQueryCache;
        const reloadQuery = this.reloadQueryCache = { query: [] };
        for (const key in this.query) {
            if (key === 'sync_keys')
                continue;
            const val = this.query[key];
            if (!val || !val.query) {
                reloadQuery.query.push(key);
            }
            else if (!val.params && Object.keys(val.query).length === 0) {
                reloadQuery.query.push({ [key]: val });
            }
        }
        return reloadQuery;
    }
    update(data) {
        for (const key in data) {
            const subQuery = this.query.attributes[key];
            if (subQuery && subQuery.attributes && Object.keys(subQuery.attributes).length > 0)
                continue;
            if (this.data[key] === data[key])
                continue;
            this.mark();
            this.data[key] = data[key];
            this.onChange([key], data[key]);
        }
    }
    markAndSet(key, data) {
        this.mark();
        this.data[key] = data;
    }
    mark() {
        if (!this.root || !this.root.immutable || !Object.isFrozen(this.data))
            return;
        this.data = Object.assign({}, this.data);
        this.root.mark(this.data);
        if (this.parentModel)
            this.parentModel.markAndSet(this.parentKey, this.data);
    }
    onChange(path, data) {
        if (this.parentModel)
            this.parentModel.onChange([this.parentKey, ...path], data);
    }
}
class ArSyncCollection extends ArSyncContainerBase {
    constructor(sync_keys, path, query, params, data, initialRequest, root) {
        super();
        this.root = root;
        this.path = path;
        if (initialRequest)
            this.initForReload(initialRequest);
        if (params && (params.order || params.limit)) {
            this.order = { limit: params.limit, mode: params.order || 'asc' };
        }
        else {
            this.order = { limit: null, mode: 'asc' };
        }
        this.query = query;
        this.data = [];
        this.children = [];
        this.replaceData(data, sync_keys);
    }
    setSyncKeys(sync_keys) {
        if (sync_keys) {
            this.sync_keys = sync_keys.map(key => key + this.path);
        }
        else {
            this.sync_keys = [];
        }
    }
    replaceData(data, sync_keys) {
        this.setSyncKeys(sync_keys);
        const existings = {};
        for (const child of this.children)
            existings[child.data.id] = child;
        let collection;
        if (data.collection && data.order) {
            collection = data.collection;
            this.order = data.order;
        }
        else {
            collection = data;
        }
        const newChildren = [];
        const newData = [];
        for (const subData of collection) {
            let model = existings[subData.id];
            if (model) {
                model.replaceData(subData);
            }
            else {
                model = new ArSyncRecord(this.query, subData, null, this.root);
                model.parentModel = this;
                model.parentKey = subData.id;
            }
            newChildren.push(model);
            newData.push(model.data);
        }
        while (this.children.length) {
            const child = this.children.pop();
            if (!existings[child.data.id])
                child.release();
        }
        if (this.data.length || newChildren.length)
            this.mark();
        while (this.data.length)
            this.data.pop();
        for (const child of newChildren)
            this.children.push(child);
        for (const el of newData)
            this.data.push(el);
        this.subscribeAll();
    }
    consumeAdd(className, id) {
        if (this.data.findIndex(a => a.id === id) >= 0)
            return;
        if (this.order.limit === this.data.length) {
            if (this.order.mode === 'asc') {
                const last = this.data[this.data.length - 1];
                if (last && last.id < id)
                    return;
            }
            else {
                const last = this.data[this.data.length - 1];
                if (last && last.id > id)
                    return;
            }
        }
        ModelBatchRequest.fetch(className, this.query, id).then((data) => {
            if (!data)
                return;
            const model = new ArSyncRecord(this.query, data, null, this.root);
            model.parentModel = this;
            model.parentKey = id;
            const overflow = this.order.limit && this.order.limit === this.data.length;
            let rmodel;
            this.mark();
            if (this.order.mode === 'asc') {
                const last = this.data[this.data.length - 1];
                this.children.push(model);
                this.data.push(model.data);
                if (last && last.id > id) {
                    this.children.sort((a, b) => a.data.id < b.data.id ? -1 : +1);
                    this.data.sort((a, b) => a.id < b.id ? -1 : +1);
                }
                if (overflow) {
                    rmodel = this.children.shift();
                    rmodel.release();
                    this.data.shift();
                }
            }
            else {
                const first = this.data[0];
                this.children.unshift(model);
                this.data.unshift(model.data);
                if (first && first.id > id) {
                    this.children.sort((a, b) => a.data.id > b.data.id ? -1 : +1);
                    this.data.sort((a, b) => a.id > b.id ? -1 : +1);
                }
                if (overflow) {
                    rmodel = this.children.pop();
                    rmodel.release();
                    this.data.pop();
                }
            }
            this.onChange([model.id], model.data);
            if (rmodel)
                this.onChange([rmodel.id], null);
        });
    }
    consumeRemove(id) {
        const idx = this.data.findIndex(a => a.id === id);
        if (idx < 0)
            return;
        this.mark();
        this.children[idx].release();
        this.children.splice(idx, 1);
        this.data.splice(idx, 1);
        this.onChange([id], null);
    }
    onNotify(notifyData) {
        if (notifyData.action === 'add') {
            this.consumeAdd(notifyData.class_name, notifyData.id);
        }
        else if (notifyData.action === 'remove') {
            this.consumeRemove(notifyData.id);
        }
    }
    subscribeAll() {
        const callback = data => this.onNotify(data);
        for (const key of this.sync_keys)
            this.subscribe(key, callback);
    }
    markAndSet(id, data) {
        this.mark();
        const idx = this.data.findIndex(a => a.id === id);
        if (idx >= 0)
            this.data[idx] = data;
    }
    mark() {
        if (!this.root || !this.root.immutable || !Object.isFrozen(this.data))
            return;
        this.data = [...this.data];
        this.root.mark(this.data);
        if (this.parentModel)
            this.parentModel.markAndSet(this.parentKey, this.data);
    }
}
class ArSyncStore {
    constructor(request, { immutable } = {}) {
        this.immutable = immutable;
        this.markedForFreezeObjects = [];
        this.changes = [];
        this.eventListeners = { events: {}, serial: 0 };
        this.request = request;
        this.complete = false;
        this.data = null;
        this.load(0);
    }
    load(retryCount) {
        ArSyncContainerBase.load(this.request, this).then((container) => {
            if (this.markForRelease) {
                container.release();
                return;
            }
            this.container = container;
            this.data = container.data;
            if (this.immutable)
                this.freezeRecursive(this.data);
            this.complete = true;
            this.notfound = false;
            this.trigger('load');
            this.trigger('change', { path: [], value: this.data });
            container.onChange = (path, value) => {
                this.changes.push({ path, value });
                this.setChangesBufferTimer();
            };
            container.onConnectionChange = state => {
                this.trigger('connection', state);
            };
        }).catch(e => {
            if (this.markForRelease)
                return;
            if (!e.retry) {
                this.complete = true;
                this.notfound = true;
                this.trigger('load');
                return;
            }
            const sleepSeconds = Math.min(Math.pow(2, retryCount), 30);
            this.retryLoadTimer = setTimeout(() => {
                this.retryLoadTimer = null;
                this.load(retryCount + 1);
            }, sleepSeconds * 1000);
        });
    }
    setChangesBufferTimer() {
        if (this.changesBufferTimer)
            return;
        this.changesBufferTimer = setTimeout(() => {
            this.changesBufferTimer = null;
            const changes = this.changes;
            this.changes = [];
            this.freezeMarked();
            this.data = this.container.data;
            changes.forEach(patch => this.trigger('change', patch));
        }, 20);
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
    mark(object) {
        this.markedForFreezeObjects.push(object);
    }
    freezeRecursive(obj) {
        if (Object.isFrozen(obj))
            return obj;
        for (const key in obj)
            this.freezeRecursive(obj[key]);
        Object.freeze(obj);
    }
    freezeMarked() {
        this.markedForFreezeObjects.forEach(obj => this.freezeRecursive(obj));
        this.markedForFreezeObjects = [];
    }
    release() {
        if (this.retryLoadTimer)
            clearTimeout(this.retryLoadTimer);
        if (this.changesBufferTimer)
            clearTimeout(this.changesBufferTimer);
        if (this.container) {
            this.container.release();
        }
        else {
            this.markForRelease = true;
        }
    }
}
exports.default = ArSyncStore;
