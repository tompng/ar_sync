export default class ConnectionManager {
  subscriptions
  adapter
  networkListeners
  networkListenerSerial
  networkStatus
  constructor(adapter) {
    this.subscriptions = {}
    this.adapter = adapter
    this.networkListeners = {}
    this.networkListenerSerial = 0
    this.networkStatus = true
    adapter.ondisconnect = () => {
      this.unsubscribeAll()
      this.triggerNetworkChange(false)
    }
    adapter.onreconnect = () => this.triggerNetworkChange(true)
  }
  triggerNetworkChange(status) {
    if (this.networkStatus == status) return
    this.networkStatus = status
    for (const id in this.networkListeners) this.networkListeners[id](status)
  }
  unsubscribeAll() {
    for (const id in this.subscriptions) {
      const subscription = this.subscriptions[id]
      subscription.listeners = {}
      subscription.connection.unsubscribe()
    }
    this.subscriptions = {}
  }
  subscribeNetwork(func) {
    const id = this.networkListenerSerial++
    this.networkListeners[id] = func
    const unsubscribe = () => {
      delete this.networkListeners[id]
    }
    return { unsubscribe }
  }
  subscribe(key, func) {
    const subscription = this.connect(key)
    const id = subscription.serial++
    subscription.ref++
    subscription.listeners[id] = func
    const unsubscribe = () => {
      if (!subscription.listeners[id]) return
      delete subscription.listeners[id]
      subscription.ref--
      if (subscription.ref === 0) this.disconnect(key)
    }
    return { unsubscribe }
  }
  connect(key) {
    if (this.subscriptions[key]) return this.subscriptions[key]
    const connection = this.adapter.subscribe(key, data => this.received(key, data))
    return this.subscriptions[key] = { connection, listeners: {}, ref: 0, serial: 0 }
  }
  disconnect(key) {
    const subscription = this.subscriptions[key]
    if (!subscription || subscription.ref !== 0) return
    delete this.subscriptions[key]
    subscription.connection.unsubscribe()
  }
  received(key, data) {
    const subscription = this.subscriptions[key]
    if (!subscription) return
    for (const id in subscription.listeners) subscription.listeners[id](data)
  }
}
