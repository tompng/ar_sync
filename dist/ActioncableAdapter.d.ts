export default class ActionCableAdapter {
    connected: any;
    _cable: any;
    constructor();
    subscribe(key: any, received: any): any;
    ondisconnect(): void;
    onreconnect(): void;
}
