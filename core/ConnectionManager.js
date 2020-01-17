"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ConnectionManager = /** @class */ (function () {
    function ConnectionManager(adapter) {
        var _this = this;
        this.subscriptions = {};
        this.adapter = adapter;
        this.networkListeners = {};
        this.networkListenerSerial = 0;
        this.networkStatus = true;
        adapter.ondisconnect = function () {
            _this.unsubscribeAll();
            _this.triggerNetworkChange(false);
        };
        adapter.onreconnect = function () { return _this.triggerNetworkChange(true); };
    }
    ConnectionManager.prototype.triggerNetworkChange = function (status) {
        if (this.networkStatus == status)
            return;
        this.networkStatus = status;
        for (var id in this.networkListeners)
            this.networkListeners[id](status);
    };
    ConnectionManager.prototype.unsubscribeAll = function () {
        for (var id in this.subscriptions) {
            var subscription = this.subscriptions[id];
            subscription.listeners = {};
            subscription.connection.unsubscribe();
        }
        this.subscriptions = {};
    };
    ConnectionManager.prototype.subscribeNetwork = function (func) {
        var _this = this;
        var id = this.networkListenerSerial++;
        this.networkListeners[id] = func;
        var unsubscribe = function () {
            delete _this.networkListeners[id];
        };
        return { unsubscribe: unsubscribe };
    };
    ConnectionManager.prototype.subscribe = function (key, func) {
        var _this = this;
        var subscription = this.connect(key);
        var id = subscription.serial++;
        subscription.ref++;
        subscription.listeners[id] = func;
        var unsubscribe = function () {
            if (!subscription.listeners[id])
                return;
            delete subscription.listeners[id];
            subscription.ref--;
            if (subscription.ref === 0)
                _this.disconnect(key);
        };
        return { unsubscribe: unsubscribe };
    };
    ConnectionManager.prototype.connect = function (key) {
        var _this = this;
        if (this.subscriptions[key])
            return this.subscriptions[key];
        var connection = this.adapter.subscribe(key, function (data) { return _this.received(key, data); });
        return this.subscriptions[key] = { connection: connection, listeners: {}, ref: 0, serial: 0 };
    };
    ConnectionManager.prototype.disconnect = function (key) {
        var subscription = this.subscriptions[key];
        if (!subscription || subscription.ref !== 0)
            return;
        delete this.subscriptions[key];
        subscription.connection.unsubscribe();
    };
    ConnectionManager.prototype.received = function (key, data) {
        var subscription = this.subscriptions[key];
        if (!subscription)
            return;
        for (var id in subscription.listeners)
            subscription.listeners[id](data);
    };
    return ConnectionManager;
}());
exports.default = ConnectionManager;
