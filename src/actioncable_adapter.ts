import * as ActionCable from 'actioncable'

export default class ArSyncActionCableAdapter {
  connected
  _cable
  constructor() {
    this.connected = true
    this.subscribe(Math.random(), () => {})
  }
  subscribe(key, received) {
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
    if (!this._cable) this._cable = ActionCable.createConsumer()
    return this._cable.subscriptions.create(
      { channel: 'SyncChannel', key },
      { received, disconnected, connected }
    )
  }
  ondisconnect() {}
  onreconnect() {}
}
