"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ArSyncApi_1 = require("./ArSyncApi");
var ModelBatchRequest = /** @class */ (function () {
    function ModelBatchRequest() {
        this.timer = null;
        this.apiRequests = new Map();
    }
    ModelBatchRequest.prototype.fetch = function (api, query, id) {
        var _this = this;
        this.setTimer();
        return new Promise(function (resolve, reject) {
            var queryJSON = JSON.stringify(query);
            var apiRequest = _this.apiRequests.get(api);
            if (!apiRequest)
                _this.apiRequests.set(api, apiRequest = new Map());
            var queryRequests = apiRequest.get(queryJSON);
            if (!queryRequests)
                apiRequest.set(queryJSON, queryRequests = { query: query, requests: new Map() });
            var request = queryRequests.requests.get(id);
            if (!request)
                queryRequests.requests.set(id, request = { id: id, callbacks: [] });
            request.callbacks.push({ resolve: resolve, reject: reject });
        });
    };
    ModelBatchRequest.prototype.batchFetch = function () {
        this.apiRequests.forEach(function (apiRequest, api) {
            apiRequest.forEach(function (_a) {
                var query = _a.query, requests = _a.requests;
                var ids = Array.from(requests.keys());
                ArSyncApi_1.default.syncFetch({ api: api, query: query, params: { ids: ids } }).then(function (models) {
                    for (var _i = 0, models_1 = models; _i < models_1.length; _i++) {
                        var model = models_1[_i];
                        var req = requests.get(model.id);
                        if (req)
                            req.model = model;
                    }
                    requests.forEach(function (_a) {
                        var model = _a.model, callbacks = _a.callbacks;
                        callbacks.forEach(function (cb) { return cb.resolve(model); });
                    });
                }).catch(function (e) {
                    requests.forEach(function (_a) {
                        var callbacks = _a.callbacks;
                        callbacks.forEach(function (cb) { return cb.reject(e); });
                    });
                });
            });
        });
        this.apiRequests.clear();
    };
    ModelBatchRequest.prototype.setTimer = function () {
        var _this = this;
        if (this.timer)
            return;
        this.timer = setTimeout(function () {
            _this.timer = null;
            _this.batchFetch();
        }, 20);
    };
    return ModelBatchRequest;
}());
var modelBatchRequest = new ModelBatchRequest;
var ArSyncContainerBase = /** @class */ (function () {
    function ArSyncContainerBase() {
        this.listeners = [];
    }
    ArSyncContainerBase.prototype.replaceData = function (_data, _sync_keys) { };
    ArSyncContainerBase.prototype.initForReload = function (request) {
        var _this = this;
        this.networkSubscriber = ArSyncStore.connectionManager.subscribeNetwork(function (state) {
            if (state) {
                ArSyncApi_1.default.syncFetch(request).then(function (data) {
                    if (_this.data) {
                        _this.replaceData(data);
                        if (_this.onConnectionChange)
                            _this.onConnectionChange(true);
                        if (_this.onChange)
                            _this.onChange([], _this.data);
                    }
                }).catch(function (e) {
                    console.error("failed to reload. " + e);
                });
            }
            else {
                if (_this.onConnectionChange)
                    _this.onConnectionChange(false);
            }
        });
    };
    ArSyncContainerBase.prototype.release = function () {
        if (this.networkSubscriber)
            this.networkSubscriber.unsubscribe();
        this.unsubscribeAll();
        for (var _i = 0, _a = Object.values(this.children); _i < _a.length; _i++) {
            var child = _a[_i];
            if (child)
                child.release();
        }
        this.data = null;
    };
    ArSyncContainerBase.prototype.onChange = function (path, data) {
        if (this.parentModel)
            this.parentModel.onChange(__spreadArrays([this.parentKey], path), data);
    };
    ArSyncContainerBase.prototype.subscribe = function (key, listener) {
        this.listeners.push(ArSyncStore.connectionManager.subscribe(key, listener));
    };
    ArSyncContainerBase.prototype.unsubscribeAll = function () {
        for (var _i = 0, _a = this.listeners; _i < _a.length; _i++) {
            var l = _a[_i];
            l.unsubscribe();
        }
        this.listeners = [];
    };
    ArSyncContainerBase.compactQuery = function (query) {
        function compactAttributes(attributes) {
            var attrs = {};
            var keys = [];
            for (var key in attributes) {
                var c = compactQuery(attributes[key]);
                if (c === true) {
                    keys.push(key);
                }
                else {
                    attrs[key] = c;
                }
            }
            if (Object.keys(attrs).length === 0) {
                if (keys.length === 0)
                    return [true, false];
                if (keys.length === 1)
                    return [keys[0], false];
                return [keys, false];
            }
            var needsEscape = attrs['attributes'] || attrs['params'] || attrs['as'];
            if (keys.length === 0)
                return [attrs, needsEscape];
            return [__spreadArrays(keys, [attrs]), needsEscape];
        }
        function compactQuery(query) {
            if (!('attributes' in query))
                return true;
            var as = query.as, params = query.params;
            var _a = compactAttributes(query.attributes), attributes = _a[0], needsEscape = _a[1];
            if (as == null && params == null) {
                if (needsEscape)
                    return { attributes: attributes };
                return attributes;
            }
            var result = {};
            if (as)
                result.as = as;
            if (params)
                result.params = params;
            if (attributes !== true)
                result.attributes = attributes;
            return result;
        }
        var result = compactQuery(query);
        return result === true ? {} : result;
    };
    ArSyncContainerBase.parseQuery = function (query, attrsonly) {
        var attributes = {};
        var column = null;
        var params = null;
        if (!query)
            query = [];
        if (query.constructor !== Array)
            query = [query];
        for (var _i = 0, query_1 = query; _i < query_1.length; _i++) {
            var arg = query_1[_i];
            if (typeof (arg) === 'string') {
                attributes[arg] = {};
            }
            else if (typeof (arg) === 'object') {
                for (var key in arg) {
                    var value = arg[key];
                    if (attrsonly) {
                        attributes[key] = this.parseQuery(value);
                        continue;
                    }
                    if (key === 'attributes') {
                        var child = this.parseQuery(value, true);
                        for (var k in child)
                            attributes[k] = child[k];
                    }
                    else if (key === 'as') {
                        column = value;
                    }
                    else if (key === 'params') {
                        params = value;
                    }
                    else {
                        attributes[key] = this.parseQuery(value);
                    }
                }
            }
        }
        if (attrsonly)
            return attributes;
        return { attributes: attributes, as: column, params: params };
    };
    ArSyncContainerBase._load = function (_a, root) {
        var api = _a.api, id = _a.id, params = _a.params, query = _a.query;
        var parsedQuery = ArSyncRecord.parseQuery(query);
        var compactQuery = ArSyncRecord.compactQuery(parsedQuery);
        if (id) {
            return modelBatchRequest.fetch(api, compactQuery, id).then(function (data) {
                if (!data)
                    throw { retry: false };
                return new ArSyncRecord(parsedQuery, data, null, root);
            });
        }
        else {
            var request_1 = { api: api, query: compactQuery, params: params };
            return ArSyncApi_1.default.syncFetch(request_1).then(function (response) {
                if (!response) {
                    throw { retry: false };
                }
                else if (response.collection && response.order) {
                    return new ArSyncCollection(response.sync_keys, 'collection', parsedQuery, response, request_1, root);
                }
                else if (response instanceof Array) {
                    return new ArSyncCollection([], '', parsedQuery, response, request_1, root);
                }
                else {
                    return new ArSyncRecord(parsedQuery, response, request_1, root);
                }
            });
        }
    };
    ArSyncContainerBase.load = function (apiParams, root) {
        var _this = this;
        if (!(apiParams instanceof Array))
            return this._load(apiParams, root);
        return new Promise(function (resolve, _reject) {
            var resultModels = [];
            var countdown = apiParams.length;
            apiParams.forEach(function (param, i) {
                _this._load(param, root).then(function (model) {
                    resultModels[i] = model;
                    countdown--;
                    if (countdown === 0)
                        resolve(resultModels);
                });
            });
        });
    };
    return ArSyncContainerBase;
}());
var ArSyncRecord = /** @class */ (function (_super) {
    __extends(ArSyncRecord, _super);
    function ArSyncRecord(query, data, request, root) {
        var _this = _super.call(this) || this;
        _this.root = root;
        if (request)
            _this.initForReload(request);
        _this.query = query;
        _this.queryAttributes = query.attributes || {};
        _this.data = {};
        _this.children = {};
        _this.replaceData(data);
        return _this;
    }
    ArSyncRecord.prototype.setSyncKeys = function (sync_keys) {
        this.sync_keys = sync_keys !== null && sync_keys !== void 0 ? sync_keys : [];
    };
    ArSyncRecord.prototype.replaceData = function (data) {
        this.setSyncKeys(data.sync_keys);
        this.unsubscribeAll();
        if (this.data.id !== data.id) {
            this.mark();
            this.data.id = data.id;
        }
        this.paths = [];
        for (var key in this.queryAttributes) {
            var subQuery = this.queryAttributes[key];
            var aliasName = subQuery.as || key;
            var subData = data[aliasName];
            var child = this.children[aliasName];
            if (key === 'sync_keys')
                continue;
            if (subData instanceof Array || (subData && subData.collection && subData.order)) {
                if (child) {
                    child.replaceData(subData, this.sync_keys);
                }
                else {
                    var collection = new ArSyncCollection(this.sync_keys, key, subQuery, subData, null, this.root);
                    this.mark();
                    this.children[aliasName] = collection;
                    this.data[aliasName] = collection.data;
                    collection.parentModel = this;
                    collection.parentKey = aliasName;
                }
            }
            else {
                if (subQuery.attributes && Object.keys(subQuery.attributes).length > 0)
                    this.paths.push(key);
                if (subData && subData.sync_keys) {
                    if (child) {
                        child.replaceData(subData);
                    }
                    else {
                        var model = new ArSyncRecord(subQuery, subData, null, this.root);
                        this.mark();
                        this.children[aliasName] = model;
                        this.data[aliasName] = model.data;
                        model.parentModel = this;
                        model.parentKey = aliasName;
                    }
                }
                else {
                    if (child) {
                        child.release();
                        delete this.children[aliasName];
                    }
                    if (this.data[aliasName] !== subData) {
                        this.mark();
                        this.data[aliasName] = subData;
                    }
                }
            }
        }
        if (this.queryAttributes['*']) {
            for (var key in data) {
                if (!this.queryAttributes[key] && this.data[key] !== data[key]) {
                    this.mark();
                    this.data[key] = data[key];
                }
            }
        }
        this.subscribeAll();
    };
    ArSyncRecord.prototype.onNotify = function (notifyData, path) {
        var _this = this;
        var action = notifyData.action, className = notifyData.class_name, id = notifyData.id;
        var query = path && this.queryAttributes[path];
        var aliasName = (query && query.as) || path;
        if (action === 'remove') {
            var child = this.children[aliasName];
            if (child)
                child.release();
            this.children[aliasName] = null;
            this.mark();
            this.data[aliasName] = null;
            this.onChange([aliasName], null);
        }
        else if (action === 'add') {
            if (this.data[aliasName] && this.data[aliasName].id === id)
                return;
            modelBatchRequest.fetch(className, ArSyncRecord.compactQuery(query), id).then(function (data) {
                if (!data || !_this.data)
                    return;
                var model = new ArSyncRecord(query, data, null, _this.root);
                var child = _this.children[aliasName];
                if (child)
                    child.release();
                _this.children[aliasName] = model;
                _this.mark();
                _this.data[aliasName] = model.data;
                model.parentModel = _this;
                model.parentKey = aliasName;
                _this.onChange([aliasName], model.data);
            }).catch(function (e) {
                console.error("failed to load " + className + ":" + id + " " + e);
            });
        }
        else {
            var field = notifyData.field;
            var query_2 = field ? this.patchQuery(field) : this.reloadQuery();
            if (!query_2)
                return;
            modelBatchRequest.fetch(className, query_2, id).then(function (data) {
                if (_this.data)
                    _this.update(data);
            }).catch(function (e) {
                console.error("failed to load patch " + className + ":" + id + " " + e);
            });
        }
    };
    ArSyncRecord.prototype.subscribeAll = function () {
        var _this = this;
        var callback = function (data) { return _this.onNotify(data); };
        for (var _i = 0, _a = this.sync_keys; _i < _a.length; _i++) {
            var key = _a[_i];
            this.subscribe(key, callback);
        }
        var _loop_1 = function (path) {
            var pathCallback = function (data) { return _this.onNotify(data, path); };
            for (var _i = 0, _a = this_1.sync_keys; _i < _a.length; _i++) {
                var key = _a[_i];
                this_1.subscribe(key + path, pathCallback);
            }
        };
        var this_1 = this;
        for (var _b = 0, _c = this.paths; _b < _c.length; _b++) {
            var path = _c[_b];
            _loop_1(path);
        }
    };
    ArSyncRecord.prototype.patchQuery = function (key) {
        var val = this.queryAttributes[key];
        if (!val)
            return;
        var attributes = val.attributes, as = val.as, params = val.params;
        if (attributes && Object.keys(val.attributes).length === 0)
            attributes = null;
        if (!attributes && !as && !params)
            return key;
        var result = {};
        if (attributes)
            result.attributes = attributes;
        if (as)
            result.as = as;
        if (params)
            result.params = params;
        return result;
    };
    ArSyncRecord.prototype.reloadQuery = function () {
        var _a;
        if (this.reloadQueryCache)
            return this.reloadQueryCache;
        var reloadQuery = this.reloadQueryCache = { attributes: [] };
        for (var key in this.queryAttributes) {
            if (key === 'sync_keys')
                continue;
            var val = this.queryAttributes[key];
            if (!val || !val.attributes) {
                reloadQuery.attributes.push(key);
            }
            else if (!val.params && Object.keys(val.attributes).length === 0) {
                reloadQuery.attributes.push((_a = {}, _a[key] = val, _a));
            }
        }
        return reloadQuery;
    };
    ArSyncRecord.prototype.update = function (data) {
        for (var key in data) {
            var subQuery = this.queryAttributes[key];
            if (subQuery && subQuery.attributes && Object.keys(subQuery.attributes).length > 0)
                continue;
            if (this.data[key] === data[key])
                continue;
            this.mark();
            this.data[key] = data[key];
            this.onChange([key], data[key]);
        }
    };
    ArSyncRecord.prototype.markAndSet = function (key, data) {
        this.mark();
        this.data[key] = data;
    };
    ArSyncRecord.prototype.mark = function () {
        if (!this.root || !this.root.immutable || !Object.isFrozen(this.data))
            return;
        this.data = __assign({}, this.data);
        this.root.mark(this.data);
        if (this.parentModel)
            this.parentModel.markAndSet(this.parentKey, this.data);
    };
    return ArSyncRecord;
}(ArSyncContainerBase));
var ArSyncCollection = /** @class */ (function (_super) {
    __extends(ArSyncCollection, _super);
    function ArSyncCollection(sync_keys, path, query, data, request, root) {
        var _this = _super.call(this) || this;
        _this.order = { limit: null, mode: 'asc', key: 'id' };
        _this.aliasOrderKey = 'id';
        _this.root = root;
        _this.path = path;
        _this.query = query;
        _this.queryAttributes = query.attributes || {};
        _this.compactQuery = ArSyncRecord.compactQuery(query);
        if (request)
            _this.initForReload(request);
        if (query.params && (query.params.order || query.params.limit)) {
            _this.setOrdering(query.params.limit, query.params.order);
        }
        _this.data = [];
        _this.children = [];
        _this.replaceData(data, sync_keys);
        return _this;
    }
    ArSyncCollection.prototype.setOrdering = function (limit, order) {
        var mode = 'asc';
        var key = 'id';
        if (order === 'asc' || order === 'desc') {
            mode = order;
        }
        else if (typeof order === 'object' && order) {
            var keys = Object.keys(order);
            if (keys.length > 1)
                throw 'multiple order keys are not supported';
            if (keys.length === 1)
                key = keys[0];
            mode = order[key] === 'asc' ? 'asc' : 'desc';
        }
        var limitNumber = (typeof limit === 'number') ? limit : null;
        if (limitNumber !== null && key !== 'id')
            throw 'limit with custom order key is not supported';
        var subQuery = this.queryAttributes[key];
        this.aliasOrderKey = (subQuery && subQuery.as) || key;
        this.order = { limit: limitNumber, mode: mode, key: key };
    };
    ArSyncCollection.prototype.setSyncKeys = function (sync_keys) {
        var _this = this;
        if (sync_keys) {
            this.sync_keys = sync_keys.map(function (key) { return key + _this.path; });
        }
        else {
            this.sync_keys = [];
        }
    };
    ArSyncCollection.prototype.replaceData = function (data, sync_keys) {
        this.setSyncKeys(sync_keys);
        var existings = new Map();
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            existings.set(child.data.id, child);
        }
        var collection;
        if ('collection' in data && 'order' in data) {
            collection = data.collection;
            this.setOrdering(data.order.limit, data.order.mode);
        }
        else {
            collection = data;
        }
        var newChildren = [];
        var newData = [];
        for (var _b = 0, collection_1 = collection; _b < collection_1.length; _b++) {
            var subData = collection_1[_b];
            var model = undefined;
            if (typeof (subData) === 'object' && subData && 'sync_keys' in subData)
                model = existings.get(subData.id);
            var data_1 = subData;
            if (model) {
                model.replaceData(subData);
            }
            else if (subData.sync_keys) {
                model = new ArSyncRecord(this.query, subData, null, this.root);
                model.parentModel = this;
                model.parentKey = subData.id;
            }
            if (model) {
                newChildren.push(model);
                data_1 = model.data;
            }
            newData.push(data_1);
        }
        while (this.children.length) {
            var child = this.children.pop();
            if (!existings.has(child.data.id))
                child.release();
        }
        if (this.data.length || newChildren.length)
            this.mark();
        while (this.data.length)
            this.data.pop();
        for (var _c = 0, newChildren_1 = newChildren; _c < newChildren_1.length; _c++) {
            var child = newChildren_1[_c];
            this.children.push(child);
        }
        for (var _d = 0, newData_1 = newData; _d < newData_1.length; _d++) {
            var el = newData_1[_d];
            this.data.push(el);
        }
        this.subscribeAll();
    };
    ArSyncCollection.prototype.consumeAdd = function (className, id) {
        var _this = this;
        if (this.data.findIndex(function (a) { return a.id === id; }) >= 0)
            return;
        if (this.order.limit === this.data.length) {
            if (this.order.mode === 'asc') {
                var last = this.data[this.data.length - 1];
                if (last && last.id < id)
                    return;
            }
            else {
                var last = this.data[this.data.length - 1];
                if (last && last.id > id)
                    return;
            }
        }
        modelBatchRequest.fetch(className, this.compactQuery, id).then(function (data) {
            if (!data || !_this.data)
                return;
            var model = new ArSyncRecord(_this.query, data, null, _this.root);
            model.parentModel = _this;
            model.parentKey = id;
            var overflow = _this.order.limit && _this.order.limit === _this.data.length;
            var rmodel;
            _this.mark();
            var orderKey = _this.aliasOrderKey;
            if (_this.order.mode === 'asc') {
                var last = _this.data[_this.data.length - 1];
                _this.children.push(model);
                _this.data.push(model.data);
                if (last && last[orderKey] > data[orderKey])
                    _this.markAndSort();
                if (overflow) {
                    rmodel = _this.children.shift();
                    rmodel.release();
                    _this.data.shift();
                }
            }
            else {
                var first = _this.data[0];
                _this.children.unshift(model);
                _this.data.unshift(model.data);
                if (first && first[orderKey] > data[orderKey])
                    _this.markAndSort();
                if (overflow) {
                    rmodel = _this.children.pop();
                    rmodel.release();
                    _this.data.pop();
                }
            }
            _this.onChange([model.id], model.data);
            if (rmodel)
                _this.onChange([rmodel.id], null);
        }).catch(function (e) {
            console.error("failed to load " + className + ":" + id + " " + e);
        });
    };
    ArSyncCollection.prototype.markAndSort = function () {
        this.mark();
        var orderKey = this.aliasOrderKey;
        if (this.order.mode === 'asc') {
            this.children.sort(function (a, b) { return a.data[orderKey] < b.data[orderKey] ? -1 : +1; });
            this.data.sort(function (a, b) { return a[orderKey] < b[orderKey] ? -1 : +1; });
        }
        else {
            this.children.sort(function (a, b) { return a.data[orderKey] > b.data[orderKey] ? -1 : +1; });
            this.data.sort(function (a, b) { return a[orderKey] > b[orderKey] ? -1 : +1; });
        }
    };
    ArSyncCollection.prototype.consumeRemove = function (id) {
        var idx = this.data.findIndex(function (a) { return a.id === id; });
        if (idx < 0)
            return;
        this.mark();
        this.children[idx].release();
        this.children.splice(idx, 1);
        this.data.splice(idx, 1);
        this.onChange([id], null);
    };
    ArSyncCollection.prototype.onNotify = function (notifyData) {
        if (notifyData.action === 'add') {
            this.consumeAdd(notifyData.class_name, notifyData.id);
        }
        else if (notifyData.action === 'remove') {
            this.consumeRemove(notifyData.id);
        }
    };
    ArSyncCollection.prototype.subscribeAll = function () {
        var _this = this;
        var callback = function (data) { return _this.onNotify(data); };
        for (var _i = 0, _a = this.sync_keys; _i < _a.length; _i++) {
            var key = _a[_i];
            this.subscribe(key, callback);
        }
    };
    ArSyncCollection.prototype.onChange = function (path, data) {
        _super.prototype.onChange.call(this, path, data);
        if (path[1] === this.aliasOrderKey)
            this.markAndSort();
    };
    ArSyncCollection.prototype.markAndSet = function (id, data) {
        this.mark();
        var idx = this.data.findIndex(function (a) { return a.id === id; });
        if (idx >= 0)
            this.data[idx] = data;
    };
    ArSyncCollection.prototype.mark = function () {
        if (!this.root || !this.root.immutable || !Object.isFrozen(this.data))
            return;
        this.data = __spreadArrays(this.data);
        this.root.mark(this.data);
        if (this.parentModel)
            this.parentModel.markAndSet(this.parentKey, this.data);
    };
    return ArSyncCollection;
}(ArSyncContainerBase));
var ArSyncStore = /** @class */ (function () {
    function ArSyncStore(request, _a) {
        var immutable = (_a === void 0 ? {} : _a).immutable;
        this.immutable = !!immutable;
        this.markedForFreezeObjects = [];
        this.changes = [];
        this.eventListeners = { events: {}, serial: 0 };
        this.request = request;
        this.complete = false;
        this.data = null;
        this.load(0);
    }
    ArSyncStore.prototype.load = function (retryCount) {
        var _this = this;
        ArSyncContainerBase.load(this.request, this).then(function (container) {
            if (_this.markForRelease) {
                container.release();
                return;
            }
            _this.container = container;
            _this.data = container.data;
            if (_this.immutable)
                _this.freezeRecursive(_this.data);
            _this.complete = true;
            _this.notfound = false;
            _this.trigger('load');
            _this.trigger('change', { path: [], value: _this.data });
            container.onChange = function (path, value) {
                _this.changes.push({ path: path, value: value });
                _this.setChangesBufferTimer();
            };
            container.onConnectionChange = function (state) {
                _this.trigger('connection', state);
            };
        }).catch(function (e) {
            if (!e || e.retry === undefined)
                throw e;
            if (_this.markForRelease)
                return;
            if (!e.retry) {
                _this.complete = true;
                _this.notfound = true;
                _this.trigger('load');
                return;
            }
            var sleepSeconds = Math.min(Math.pow(2, retryCount), 30);
            _this.retryLoadTimer = setTimeout(function () {
                _this.retryLoadTimer = null;
                _this.load(retryCount + 1);
            }, sleepSeconds * 1000);
        });
    };
    ArSyncStore.prototype.setChangesBufferTimer = function () {
        var _this = this;
        if (this.changesBufferTimer)
            return;
        this.changesBufferTimer = setTimeout(function () {
            _this.changesBufferTimer = null;
            var changes = _this.changes;
            _this.changes = [];
            _this.freezeMarked();
            _this.data = _this.container.data;
            changes.forEach(function (patch) { return _this.trigger('change', patch); });
        }, 20);
    };
    ArSyncStore.prototype.subscribe = function (event, callback) {
        var listeners = this.eventListeners.events[event];
        if (!listeners)
            this.eventListeners.events[event] = listeners = {};
        var id = this.eventListeners.serial++;
        listeners[id] = callback;
        return { unsubscribe: function () { delete listeners[id]; } };
    };
    ArSyncStore.prototype.trigger = function (event, arg) {
        var listeners = this.eventListeners.events[event];
        if (!listeners)
            return;
        for (var id in listeners)
            listeners[id](arg);
    };
    ArSyncStore.prototype.mark = function (object) {
        this.markedForFreezeObjects.push(object);
    };
    ArSyncStore.prototype.freezeRecursive = function (obj) {
        if (Object.isFrozen(obj))
            return obj;
        for (var key in obj)
            this.freezeRecursive(obj[key]);
        Object.freeze(obj);
    };
    ArSyncStore.prototype.freezeMarked = function () {
        var _this = this;
        this.markedForFreezeObjects.forEach(function (obj) { return _this.freezeRecursive(obj); });
        this.markedForFreezeObjects = [];
    };
    ArSyncStore.prototype.release = function () {
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
    };
    return ArSyncStore;
}());
exports.default = ArSyncStore;
