import ConnectionAdapter from './ConnectionAdapter'

export default class ActionCableAdapter implements ConnectionAdapter {
  connected: boolean
  _cable: any
  actionCableClass: any
  constructor(actionCableClass: any) {
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
