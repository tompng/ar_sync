ARSyncData.connectionAdapter = {
  channelName: 'SyncChannel',
  cable() {
    if (!this._cable) this._cable = ActionCable.createConsumer()
    return this._cable
  },
  connect({ key, received, disconnected, connected }) {
    return this.cable().subscriptions.create(
      { channel: this.channelName, key }, { received, disconnected, connected }
    )
  }
}
// without actioncable:
// ARSyncData.connectionAdapter = {
//   connect({ key, received, disconnected, connected }) {
//     c = new MyConnection(key)
//     c.onData(received).onDisconnect(disconnected)
//     c.onFirstConnect(connected).onReconnect(connected)
//     return { unsubscribe: c.close() }
//   }
// }
