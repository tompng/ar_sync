"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ActionCableAdapter = /** @class */ (function () {
    function ActionCableAdapter(actionCableClass) {
        this.connected = true;
        this.actionCableClass = actionCableClass;
        this.subscribe(Math.random().toString(), function () { });
    }
    ActionCableAdapter.prototype.subscribe = function (key, received) {
        var _this = this;
        var disconnected = function () {
            if (!_this.connected)
                return;
            _this.connected = false;
            _this.ondisconnect();
        };
        var connected = function () {
            if (_this.connected)
                return;
            _this.connected = true;
            _this.onreconnect();
        };
        if (!this._cable)
            this._cable = this.actionCableClass.createConsumer();
        return this._cable.subscriptions.create({ channel: 'SyncChannel', key: key }, { received: received, disconnected: disconnected, connected: connected });
    };
    ActionCableAdapter.prototype.ondisconnect = function () { };
    ActionCableAdapter.prototype.onreconnect = function () { };
    return ActionCableAdapter;
}());
exports.default = ActionCableAdapter;
