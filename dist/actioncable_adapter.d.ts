export default class ArSyncActionCableAdapter {
    connected: any;
    _cable: any;
    constructor();
    subscribe(key: any, received: any): any;
    ondisconnect(): void;
    onreconnect(): void;
}
