"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ArSyncStore_1 = require("./ArSyncStore");
var ConnectionManager_1 = require("./ConnectionManager");
var ArSyncModel = /** @class */ (function () {
    function ArSyncModel(request, option) {
        var _this = this;
        this.complete = false;
        this.destroyed = false;
        this._ref = ArSyncModel.retrieveRef(request, option);
        this._listenerSerial = 0;
        this._listeners = {};
        this.connected = ArSyncStore_1.ArSyncStore.connectionManager.networkStatus;
        var setData = function () {
            _this.data = _this._ref.model.data;
            _this.complete = _this._ref.model.complete;
            _this.notfound = _this._ref.model.notfound;
            _this.destroyed = _this._ref.model.destroyed;
        };
        setData();
        this.subscribe('load', setData);
        this.subscribe('change', setData);
        this.subscribe('destroy', setData);
        this.subscribe('connection', function (status) {
            _this.connected = status;
        });
    }
    ArSyncModel.prototype.onload = function (callback) {
        this.subscribeOnce('load', callback);
    };
    ArSyncModel.prototype.subscribeOnce = function (event, callback) {
        var subscription = this.subscribe(event, function (e) {
            callback(e);
            subscription.unsubscribe();
        });
        return subscription;
    };
    ArSyncModel.prototype.dig = function (path) {
        return ArSyncModel.digData(this.data, path);
    };
    ArSyncModel.digData = function (data, path) {
        function dig(data, path) {
            if (path.length === 0)
                return data;
            if (data == null)
                return data;
            var key = path[0];
            var other = path.slice(1);
            if (Array.isArray(data)) {
                return this.digData(data.find(function (el) { return el.id === key; }), other);
            }
            else {
                return this.digData(data[key], other);
            }
        }
        return dig(data, path);
    };
    ArSyncModel.prototype.subscribe = function (event, callback) {
        var _this = this;
        var id = this._listenerSerial++;
        var subscription = this._ref.model.subscribe(event, callback);
        var unsubscribed = false;
        var unsubscribe = function () {
            unsubscribed = true;
            subscription.unsubscribe();
            delete _this._listeners[id];
        };
        if (this.complete) {
            if (event === 'load')
                setTimeout(function () {
                    if (!unsubscribed)
                        callback();
                }, 0);
            if (event === 'change')
                setTimeout(function () {
                    if (!unsubscribed)
                        callback({ path: [], value: _this.data });
                }, 0);
        }
        return this._listeners[id] = { unsubscribe: unsubscribe };
    };
    ArSyncModel.prototype.release = function () {
        for (var id in this._listeners)
            this._listeners[id].unsubscribe();
        this._listeners = {};
        ArSyncModel._detach(this._ref);
    };
    ArSyncModel.retrieveRef = function (request, option) {
        var key = JSON.stringify([request, option]);
        var ref = this._cache[key];
        if (!ref) {
            var model = new ArSyncStore_1.ArSyncStore(request, option);
            ref = this._cache[key] = { key: key, count: 0, timer: null, model: model };
        }
        this._attach(ref);
        return ref;
    };
    ArSyncModel._detach = function (ref) {
        var _this = this;
        ref.count--;
        var timeout = this.cacheTimeout;
        if (ref.count !== 0)
            return;
        var timedout = function () {
            ref.model.release();
            delete _this._cache[ref.key];
        };
        if (timeout) {
            ref.timer = setTimeout(timedout, timeout);
        }
        else {
            timedout();
        }
    };
    ArSyncModel._attach = function (ref) {
        ref.count++;
        if (ref.timer)
            clearTimeout(ref.timer);
    };
    ArSyncModel.setConnectionAdapter = function (adapter) {
        ArSyncStore_1.ArSyncStore.connectionManager = new ConnectionManager_1.default(adapter);
    };
    ArSyncModel.waitForLoad = function () {
        var models = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            models[_i] = arguments[_i];
        }
        return new Promise(function (resolve) {
            var count = 0;
            for (var _i = 0, models_1 = models; _i < models_1.length; _i++) {
                var model = models_1[_i];
                model.onload(function () {
                    count++;
                    if (models.length == count)
                        resolve(models);
                });
            }
        });
    };
    ArSyncModel._cache = {};
    ArSyncModel.cacheTimeout = 10 * 1000;
    return ArSyncModel;
}());
exports.default = ArSyncModel;
