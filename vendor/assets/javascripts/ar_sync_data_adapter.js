(function(){
let ArSyncSubscriber, ActionCable
try {
  ArSyncSubscriber = require('./ar_sync_data')
  ActionCable = require('actioncable')
} catch(e) {
  try {
    ArSyncSubscriber = window.ArSyncSubscriber
    ActionCable = window.ActionCable
  } catch(e) {}
}
ArSyncSubscriber.connectionAdapter = {
  reconnectListeners: {},
  reconnectListenerSerial: 0,
  networkState: true,
  subscribe(key, callback) {
    const received = callback
    const disconnected = () => {
      console.error('disconnected')
      this.networkDisconnected()
    }
    if (!this._cable) this._cable = ActionCable.createConsumer()
    return this._cable.subscriptions.create(
      { channel: 'SyncChannel', key },
      { received, disconnected }
    )
  },
  networkReconnect() {
    if (this.reconnecting) return
    this.reconnecting = true
    const timer = setInterval(() => {
      if (this._cable.connection.disconnected) return
      clearInterval(timer)
      this.networkReconnected()
      this.reconnecting = false
    }, 1000)
  },
  networkDisconnected() {
    this.triggerNetwork(false)
    this.networkReconnect()
  },
  triggerNetwork(flag) {
    if (this.networkState === flag) return
    this.networkState = flag
    for (const func of Object.values(this.reconnectListeners)) func(flag)
  },
  networkReconnected() {
    this.triggerNetwork(true)
  },
  subscribeNetwork(func) {
    const id = this.reconnectListenerSerial ++
    const unsubscribe = () => {
      delete this.reconnectListeners[id]
    }
    this.reconnectListeners[id] = func
    return { unsubscribe }
  }
}
})()
// without actioncable:
// ArSyncSubscriber.connectionAdapter = {
//   connect({ key, received, disconnected, connected }) {
//     c = new MyConnection(key)
//     c.onData(received).onDisconnect(disconnected)
//     c.onFirstConnect(connected).onReconnect(connected)
//     return { unsubscribe: c.close() }
//   }
// }
