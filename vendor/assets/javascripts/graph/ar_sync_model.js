(function(){
let ArSyncStore, ArSyncConnectionManager
try {
  ArSyncStore = require('./ar_sync_container').ArSyncStore
  ArSyncConnectionManager = require('./ar_sync_connection_manager')
} catch(e) {
  ArSyncStore = window.ArSyncStore
  ArSyncConnectionManager = window.ArSyncConnectionManager
}

class ArSyncModel {
  constructor(request, option) {
    this._ref = ArSyncModel.retrieveRef(request, option)
    this._listenerSerial = 0
    this._listeners = {}
    const setData = () => {
      this.data = this._ref.model.data
      this.loaded = this._ref.model.loaded
    }
    setData()
    this.subscribe('load', setData)
    this.subscribe('change', setData)
  }
  onload(callback) {
    this.subscribeOnce('load', callback)
  }
  subscribeOnce(event, callback) {
    const subscription = this.subscribe('load', () => {
      callback()
      subscription.unsubscribe()
    })
    return subscription
  }
  subscribe(event, callback) {
    const id = this._listenerSerial++
    const subscription = this._ref.model.subscribe(event, callback)
    const unsubscribe = () => {
      subscription.unsubscribe()
      delete this._listeners[id]
    }
    if (this.loaded) {
      if (event === 'load') setTimeout(callback, 0)
      if (event === 'change') setTimeout(() => callback({ path: [], value: this.data }), 0)
    }
    return this._listeners[id] = { unsubscribe }
  }
  release() {
    for (const id in this._listeners) this._listeners[id].unsubscribe()
    this._listeners = {}
    ArSyncModel._detach(this._ref)
    this._ref = null
  }
  dig(data, path) {
    return this._ref.model.store.dig(data, path)
  }
  static setConnectionAdapter(adapter) {
    ArSyncStore.connectionManager = new ArSyncConnectionManager(adapter)
  }
  static retrieveRef(request, option) {
    const key = JSON.stringify([request, option])
    let ref = ArSyncModel._cache[key]
    if (!ref) {
      const model = new ArSyncStore(request, option)
      ref = ArSyncModel._cache[key] = { key, count: 0, timer: null, model }
    }
    ArSyncModel._attach(ref)
    return ref
  }
  static _detach(ref) {
    ref.count--
    const timeout = ArSyncModel.cacheTimeout
    if (ref.count !== 0) return
    const timedout = () => {
      ref.model.release()
      delete ArSyncModel._cache[ref.key]
    }
    if (timeout) {
      ref.timer = setTimeout(timedout, timeout)
    } else {
      timedout()
    }
  }
  static _attach(ref) {
    ref.count++
    if (ref.timer) clearTimeout(ref.timer)
  }
  static waitForLoad(...models) {
    return new Promise((resolve) => {
      let count = 0
      for (const model of models) {
        model.onload(() => {
          count++
          if (models.length == count) resolve(models)
        })
      }
    })
  }
}
ArSyncModel._cache = {}
ArSyncModel.cacheTimeout = 10 * 1000

try {
  module.exports = { ArSyncModel, ArSyncStore }
} catch (e) {
  window.ArSyncModel = ArSyncModel
  window.ArSyncStore = ArSyncStore
}
})()
