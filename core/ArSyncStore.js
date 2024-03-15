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
            if (!state) {
                if (_this.onConnectionChange)
                    _this.onConnectionChange(false);
                return;
            }
            if (request.id != null) {
                modelBatchRequest.fetch(request.api, request.query, request.id).then(function (data) {
                    if (_this.data && data) {
                        _this.replaceData(data);
                        if (_this.onConnectionChange)
                            _this.onConnectionChange(true);
                        if (_this.onChange)
                            _this.onChange([], _this.data);
                    }
                });
            }
            else {
                ArSyncApi_1.default.syncFetch(request).then(function (data) {
                    if (_this.data && data) {
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
    ArSyncContainerBase.compactQueryAttributes = function (query) {
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
        if (typeof result === 'object' && 'attributes' in result)
            return result.attributes;
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
        var compactQueryAttributes = ArSyncRecord.compactQueryAttributes(parsedQuery);
        if (id != null) {
            return modelBatchRequest.fetch(api, compactQueryAttributes, id).then(function (data) {
                if (!data)
                    throw { retry: false };
                var request = { api: api, id: id, query: compactQueryAttributes };
                return new ArSyncRecord(parsedQuery, data, request, root);
            });
        }
        else {
            var request_1 = { api: api, query: compactQueryAttributes, params: params };
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
        _this.fetching = new Set();
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
            // this.fetching.delete(`${aliasName}:${id}`) // To cancel consumeAdd
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
            var fetchKey_1 = aliasName + ":" + id;
            this.fetching.add(fetchKey_1);
            modelBatchRequest.fetch(className, ArSyncRecord.compactQueryAttributes(query), id).then(function (data) {
                // Record already removed
                if (!_this.fetching.has(fetchKey_1))
                    return;
                _this.fetching.delete(fetchKey_1);
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
        var _a;
        var subQuery = this.queryAttributes[key];
        if (subQuery)
            return _a = {}, _a[key] = subQuery, _a;
    };
    ArSyncRecord.prototype.reloadQuery = function () {
        if (this.reloadQueryCache)
            return this.reloadQueryCache;
        var arrayQuery = [];
        var hashQuery = {};
        for (var key in this.queryAttributes) {
            if (key === 'sync_keys')
                continue;
            var val = this.queryAttributes[key];
            if (!val || !val.attributes) {
                arrayQuery === null || arrayQuery === void 0 ? void 0 : arrayQuery.push(key);
                hashQuery[key] = true;
            }
            else if (!val.params && Object.keys(val.attributes).length === 0) {
                arrayQuery = null;
                hashQuery[key] = val;
            }
        }
        return this.reloadQueryCache = arrayQuery || hashQuery;
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
        _this.ordering = { orderBy: 'id', direction: 'asc' };
        _this.aliasOrderKey = 'id';
        _this.fetching = new Set();
        _this.root = root;
        _this.path = path;
        _this.query = query;
        _this.queryAttributes = query.attributes || {};
        _this.compactQueryAttributes = ArSyncRecord.compactQueryAttributes(query);
        if (request)
            _this.initForReload(request);
        if (query.params) {
            _this.setOrdering(query.params);
        }
        _this.data = [];
        _this.children = [];
        _this.replaceData(data, sync_keys);
        return _this;
    }
    ArSyncCollection.prototype.setOrdering = function (ordering) {
        var direction = 'asc';
        var orderBy = 'id';
        var first = undefined;
        var last = undefined;
        if (ordering.direction === 'desc')
            direction = ordering.direction;
        if (typeof ordering.orderBy === 'string')
            orderBy = ordering.orderBy;
        if (typeof ordering.first === 'number')
            first = ordering.first;
        if (typeof ordering.last === 'number')
            last = ordering.last;
        var subQuery = this.queryAttributes[orderBy];
        this.aliasOrderKey = (subQuery && subQuery.as) || orderBy;
        this.ordering = { first: first, last: last, direction: direction, orderBy: orderBy };
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
        if (Array.isArray(data)) {
            collection = data;
        }
        else {
            collection = data.collection;
            this.setOrdering(data.ordering);
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
        var _a = this.ordering, first = _a.first, last = _a.last, direction = _a.direction;
        var limit = first || last;
        if (this.data.findIndex(function (a) { return a.id === id; }) >= 0)
            return;
        if (limit && limit <= this.data.length) {
            var lastItem = this.data[this.data.length - 1];
            var firstItem = this.data[0];
            if (direction === 'asc') {
                if (first) {
                    if (lastItem && lastItem.id < id)
                        return;
                }
                else {
                    if (firstItem && id < firstItem.id)
                        return;
                }
            }
            else {
                if (first) {
                    if (lastItem && id < lastItem.id)
                        return;
                }
                else {
                    if (firstItem && firstItem.id < id)
                        return;
                }
            }
        }
        this.fetching.add(id);
        modelBatchRequest.fetch(className, this.compactQueryAttributes, id).then(function (data) {
            // Record already removed
            if (!_this.fetching.has(id))
                return;
            _this.fetching.delete(id);
            if (!data || !_this.data)
                return;
            var model = new ArSyncRecord(_this.query, data, null, _this.root);
            model.parentModel = _this;
            model.parentKey = id;
            var overflow = limit && limit <= _this.data.length;
            var rmodel;
            _this.mark();
            var orderKey = _this.aliasOrderKey;
            var firstItem = _this.data[0];
            var lastItem = _this.data[_this.data.length - 1];
            if (direction === 'asc') {
                if (firstItem && data[orderKey] < firstItem[orderKey]) {
                    _this.children.unshift(model);
                    _this.data.unshift(model.data);
                }
                else {
                    var skipSort = lastItem && lastItem[orderKey] < data[orderKey];
                    _this.children.push(model);
                    _this.data.push(model.data);
                    if (!skipSort)
                        _this.markAndSort();
                }
            }
            else {
                if (firstItem && data[orderKey] > firstItem[orderKey]) {
                    _this.children.unshift(model);
                    _this.data.unshift(model.data);
                }
                else {
                    var skipSort = lastItem && lastItem[orderKey] > data[orderKey];
                    _this.children.push(model);
                    _this.data.push(model.data);
                    if (!skipSort)
                        _this.markAndSort();
                }
            }
            if (overflow) {
                if (first) {
                    rmodel = _this.children.pop();
                    _this.data.pop();
                }
                else {
                    rmodel = _this.children.shift();
                    _this.data.shift();
                }
                rmodel.release();
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
        if (this.ordering.direction === 'asc') {
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
        this.fetching.delete(id); // To cancel consumeAdd
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
