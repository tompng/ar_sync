(function(){
let ArSyncSubscriber, ActionCable
try {
  ArSyncSubscriber = require('./ar_sync_data').ArSyncSubscriber
  ActionCable = require('actioncable')
} catch(e) {
  try {
    ArSyncSubscriber = window.ArSyncSubscriber
    ActionCable = window.ActionCable
  } catch(e) {}
}
ArSyncSubscriber.connectionAdapter = {
  channelName: 'SyncChannel',
  channels: {},
  cable() {
    if (!this._cable) this._cable = ActionCable.createConsumer()
    return this._cable
  },
  connect({ key, received, disconnected, connected }) {
    return this.channels[key] = this.cable().subscriptions.create(
      { channel: this.channelName, key }, { received, disconnected, connected }
    )
  },
  disconnect(key) {
    console.error('unsubscribed: ' + key)
    this.channels[key].unsubscribe()
    delete this.channels[key]
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
