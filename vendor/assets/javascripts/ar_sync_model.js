(function(){
let ArSyncStore, arSyncApiFetch, ArSyncConnectionManager
try {
  ArSyncStore = require('./ar_sync_store')
  arSyncApiFetch = require('./ar_sync_api_fetch')
  ArSyncConnectionManager = require('./ar_sync_connection_manager')
} catch(e) {
  ArSyncStore = window.ArSyncStore
  arSyncApiFetch = window.arSyncApiFetch
  ArSyncConnectionManager = window.ArSyncConnectionManager
}

class ArSyncBaseModel {
  constructor(request, option = {}) {
    this.immutable = option.immutable ? true : false
    this.request = request
    this.subscriptions = []
    this.store = null
    this.data = {}
    this.bufferedPatches = []
    this.eventListeners = { events: {}, serial: 0 }
    this.networkSubscription = ArSyncBaseModel.connectionManager.subscribeNetwork((status) => {
      if (status) {
        this.load(() => {
          this.trigger('reconnect')
          this.trigger('change')
        })
      } else {
        this.unsubscribeAll()
        this.trigger('disconnect')
      }
    })
    this.load(() => {
      this.trigger('load')
      this.loaded = true
      this.trigger('change')
    })
  }
  release() {
    this.unsubscribeAll()
    this.networkSubscription.unsubscribe()
  }
  unsubscribeAll() {
    for (const s of this.subscriptions) s.unsubscribe()
    this.subscriptions = []
  }
  load(callback) {
    arSyncApiFetch(this.request).then(syncData => {
      const { keys, data, limit, order } = syncData
      this.initializeStore(keys, data, { limit, order, immutable: this.immutable })
      if (callback) callback(this.data)
    })
  }
  patchReceived(patch) {
    const buffer = this.bufferedPatches
    buffer.push(patch)
    if (this.bufferTimer) return
    this.bufferTimer = setTimeout(() => {
      this.bufferTimer = null
      this.bufferedPatches
      const buf = this.bufferedPatches
      this.bufferedPatches = []
      const changes = this.store.batchUpdate(buf)
      this.data = this.store.data
      this.trigger('change', changes)
    }, 16)
  }
  subscribe(event, callback) {
    let listeners = this.eventListeners.events[event]
    if (!listeners) this.eventListeners.events[event] = listeners = {}
    const id = this.eventListeners.serial++
    listeners[id] = callback
    return { unsubscribe: () => { delete listeners[id] } }
  }
  trigger(event, arg) {
    console.error('event', event, arg)
    const listeners = this.eventListeners.events[event]
    if (!listeners) return
    for (const callback of Object.values(listeners)) callback(arg)
  }
  initializeStore(keys, data, option) {
    const query = this.request.query
    const prevStore = this.store
    if (this.store) {
      this.store.replaceData(data)
    } else {
      this.store = new ArSyncStore(query, data, option)
      this.data = this.store.data
    }
    this.subscriptions = keys.map(key => {
      return ArSyncBaseModel.connectionManager.subscribe(key, patch => this.patchReceived(patch))
    })
  }
}

class ArSyncModel {
  constructor(request, option) {
    this._ref = ArSyncModel.retrieveRef(request, option)
    this.data = this._ref.model.data
    this._listenerSerial = 0
    this._listeners = {}
    const setData = () => this.data = this._ref.model.data
    this.subscribe('load', setData)
    this.subscribe('change', setData)
  }
  onload(callback) {
    if (this._ref.model.loaded) {
      callback()
      return
    }
    const subscription = this.subscribe('load', () => {
      callback()
      subscription.unsubscribe()
    })
  }
  subscribe(event, callback) {
    const id = this._listenerSerial++
    const subscription = this._ref.model.subscribe(event, callback)
    const unsubscribe = () => {
      subscription.unsubscribe()
      delete this._listeners[id]
    }
    return this._listeners[id] = { unsubscribe }
  }
  release() {
    for (const s of Object.values(this._listeners)) s.unsubscribe()
    this._listeners = {}
    ArSyncModel._detach(this._ref)
    this._ref = null
  }
  static setConnectionAdapter(adapter) {
    ArSyncBaseModel.connectionManager = new ArSyncConnectionManager(adapter)
  }
  static retrieveRef(request, option) {
    const key = JSON.stringify([request, option])
    let ref = ArSyncModel._cache[key]
    if (!ref) {
      const model = new ArSyncBaseModel(request, option)
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
        console.error(model)
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
  module.exports = { ArSyncModel, ArSyncBaseModel }
} catch (e) {
  window.ArSyncModel = ArSyncModel
  window.ArSyncBaseModel = ArSyncBaseModel
}
})()
