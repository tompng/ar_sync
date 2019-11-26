"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ActionCableAdapter {
    constructor(actionCableClass) {
        this.connected = true;
        this.actionCableClass = actionCableClass;
        this.subscribe(Math.random().toString(), () => { });
    }
    subscribe(key, received) {
        const disconnected = () => {
            if (!this.connected)
                return;
            this.connected = false;
            this.ondisconnect();
        };
        const connected = () => {
            if (this.connected)
                return;
            this.connected = true;
            this.onreconnect();
        };
        if (!this._cable)
            this._cable = this.actionCableClass.createConsumer();
        return this._cable.subscriptions.create({ channel: 'SyncChannel', key }, { received, disconnected, connected });
    }
    ondisconnect() { }
    onreconnect() { }
}
exports.default = ActionCableAdapter;
