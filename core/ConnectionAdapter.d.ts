export default interface ConnectionAdapter {
    ondisconnect: (() => void) | null;
    onreconnect: (() => void) | null;
    subscribe(key: string, callback: (data: any) => void): {
        unsubscribe: () => void;
    };
}
