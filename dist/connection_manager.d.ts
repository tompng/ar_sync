export default class ArSyncConnectionManager {
    subscriptions: any;
    adapter: any;
    networkListeners: any;
    networkListenerSerial: any;
    networkStatus: any;
    constructor(adapter: any);
    triggerNetworkChange(status: any): void;
    unsubscribeAll(): void;
    subscribeNetwork(func: any): {
        unsubscribe: () => void;
    };
    subscribe(key: any, func: any): {
        unsubscribe: () => void;
    };
    connect(key: any): any;
    disconnect(key: any): void;
    received(key: any, data: any): void;
}
