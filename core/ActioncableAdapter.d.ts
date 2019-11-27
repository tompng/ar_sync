import ConnectionAdapter from './ConnectionAdapter';
declare module ActionCable {
    function createConsumer(): Cable;
    interface Cable {
        subscriptions: Subscriptions;
    }
    interface CreateMixin {
        connected: () => void;
        disconnected: () => void;
        received: (obj: any) => void;
    }
    interface ChannelNameWithParams {
        channel: string;
        [key: string]: any;
    }
    interface Subscriptions {
        create(channel: ChannelNameWithParams, obj: CreateMixin): Channel;
    }
    interface Channel {
        unsubscribe(): void;
        perform(action: string, data: {}): void;
        send(data: any): boolean;
    }
}
export default class ActionCableAdapter implements ConnectionAdapter {
    connected: boolean;
    _cable: ActionCable.Cable;
    actionCableClass: typeof ActionCable;
    constructor(actionCableClass: typeof ActionCable);
    subscribe(key: string, received: (data: any) => void): ActionCable.Channel;
    ondisconnect(): void;
    onreconnect(): void;
}
export {};
