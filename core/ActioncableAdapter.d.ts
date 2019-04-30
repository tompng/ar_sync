import * as ActionCable from 'actioncable';
import ConnectionAdapter from './ConnectionAdapter';
export default class ActionCableAdapter implements ConnectionAdapter {
    connected: boolean;
    _cable: ActionCable.Cable;
    constructor();
    subscribe(key: string, received: (data: any) => void): ActionCable.Channel;
    ondisconnect(): void;
    onreconnect(): void;
}
