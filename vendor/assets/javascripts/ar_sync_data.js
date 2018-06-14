(function(){

class ArSyncSubscriberListener {
  constructor(subscriber, id, func) {
    this.subscriber = subscriber
    this.id = id
    this.func = func
  }
  release() {
    this.subscriber.unlisten(this.id)
  }
}
class ArSyncSubscriber {
  constructor(key) {
    this.key = key
    const received = data => this.received(data)
    this.listeners = {}
    this.listenerSerial = 0
    this.listenerCount = 0
    this.subscription = ArSyncSubscriber.connectionAdapter.subscribe(key, received)
  }
  listen(func) {
    const id = this.listenerSerial++
    this.listenerCount++
    return this.listeners[id] = new ArSyncSubscriberListener(this, id, func)
  }
  unlisten(id) {
    if (!this.listeners[id]) return
    this.listenerCount--
    delete this.listeners[id]
    if (this.listenerCount === 0) {
      ArSyncSubscriber.notifyEmpty(this.key)
    }
  }
  received(data) {
    for (const l of Object.values(this.listeners)) {
      l.func(data)
    }
  }
  release() {
    this.subscription.unsubscribe()
  }
}
ArSyncSubscriber.subscribers = {}
ArSyncSubscriber.subscribe = function(key, func) {
  let s = ArSyncSubscriber.subscribers[key]
  if (!s) s = ArSyncSubscriber.subscribers[key] = new ArSyncSubscriber(key)
  return s.listen(func)
}
ArSyncSubscriber.notifyEmpty = function(key) {
  const s = ArSyncSubscriber.subscribers[key]
  if (!s) return
  s.release()
  delete ArSyncSubscriber.subscribers[key]
}

try {
  module.exports = ArSyncSubscriber
} catch (e) {
  window.ArSyncSubscriber = ArSyncSubscriber
}
})()
