import ConnectionAdapter from './ConnectionAdapter';
export default class ActionCableAdapter implements ConnectionAdapter {
    connected: boolean;
    _cable: any;
    actionCableClass: any;
    constructor(actionCableClass: any);
    subscribe(key: string, received: (data: any) => void): any;
    ondisconnect(): void;
    onreconnect(): void;
}
