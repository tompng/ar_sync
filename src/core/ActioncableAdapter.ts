import ConnectionAdapter from './ConnectionAdapter'

declare module ActionCable {
  function createConsumer(): Cable
  interface Cable {
    subscriptions: Subscriptions
  }
  interface CreateMixin {
    connected: () => void
    disconnected: () => void
    received: (obj: any) => void
  }
  interface ChannelNameWithParams {
    channel: string
    [key: string]: any
  }
  interface Subscriptions {
    create(channel: ChannelNameWithParams, obj: CreateMixin): Channel
  }
  interface Channel {
    unsubscribe(): void;
    perform(action: string, data: {}): void;
    send(data: any): boolean;
  }
}

export default class ActionCableAdapter implements ConnectionAdapter {
  connected: boolean
  _cable: ActionCable.Cable
  actionCableClass: typeof ActionCable
  constructor(actionCableClass: typeof ActionCable) {
    this.connected = true
    this.actionCableClass = actionCableClass
    this.subscribe(Math.random().toString(), () => {})
  }
  subscribe(key: string, received: (data: any) => void) {
    const disconnected = () => {
      if (!this.connected) return
      this.connected = false
      this.ondisconnect()
    }
    const connected = () => {
      if (this.connected) return
      this.connected = true
      this.onreconnect()
    }
    if (!this._cable) this._cable = this.actionCableClass.createConsumer()
    return this._cable.subscriptions.create(
      { channel: 'SyncChannel', key },
      { received, disconnected, connected }
    )
  }
  ondisconnect() {}
  onreconnect() {}
}
