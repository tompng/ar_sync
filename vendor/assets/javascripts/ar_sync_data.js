(function(){
let ArSyncStore
let arSyncApiFetch
try {
  ArSyncStore = require('./ar_sync_store')
  syncApiFetch = require('./ar_sync_api_fetch')
} catch(e) {
  ArSyncStore = window.ArSyncStore
  arSyncApiFetch = window.arSyncApiFetch
}

class ArSyncModel {
  constructor(request) {
    this.request = request
    this.subscriptions = []
    this.store = null
    this.data = {}
    this.bufferedPatches = []
    this.connectionState = { connections: {}, connected: 0, count: 0, needsReload: false }
  }
  immutable() { return false }
  release() {
    this.destroy()
  }
  destroy() {
    this.unsubscribeAll()
  }
  unsubscribeAll() {
    for (const s of this.subscriptions) s.unsubscribe()
    this.subscriptions = []
  }
  load(callback) {
    arSyncApiFetch(this.request).then(syncData => {
      this.connectionState.count = syncData.keys.length
      const { keys, data, limit, order } = syncData
      this.initializeStore(keys, data, { limit, order, immutable: this.immutable() })
    }).then(()=>{
      if (callback) callback(this.data)
    })
    return this
  }
  changed(callback) {
    this.changedCallback = callback
    return this
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
      if (this.changedCallback) this.changedCallback(changes)
    }, 16)
  }
  reconnected(callback) {
    this.reconnectedCallback = callback
  }
  disconnected(callback) {
    this.disconnectedCallback = callback
  }
  subscriptionDisconnected(key) {
    const state = this.connectionState
    if (!state.connections[key]) return
    state.connections[key] = false
    state.connected--
    if (!state.needsReload) {
      state.needsReload = true
      if (this.disconnectedCallback) this.disconnectedCallback()
    }
  }
  subscriptionConnected(key) {
    const state = this.connectionState
    if (state.connections[key]) return
    state.connections[key] = true
    state.connected++
    if (state.needsReload && state.connected === state.count) {
      state.needsReload = false
      this.load(() => {
        if (this.reconnectedCallback) this.reconnectedCallback()
        if (this.changedCallback) this.changedCallback()
      })
    }
  }
  initializeStore(keys, data, option) {
    const query = this.request.query
    const prevStore = this.store
    if (prevStore) {
      prevStore.replaceData(data)
      return
    }
    const store = new ArSyncStore(query, data, option)
    this.store = store
    this.data = store.data
    let patches = []
    const received = patch => this.patchReceived(patch)
    this.subscriptions = keys.map(key => {
      const disconnected = () => this.subscriptionDisconnected(key)
      const connected = () => this.subscriptionConnected(key)
      return ArSyncModel.connectionAdapter.connect({ key, received, disconnected, connected })
    })
  }
}

class ArSyncImmutableModel extends ArSyncModel {
  immutable() { return true }
}

try {
  module.exports = { ArSyncModel, ArSyncImmutableModel }
} catch (e) {
  window.ArSyncModel = ArSyncModel
  window.ArSyncImmutableModel = ArSyncImmutableModel
}
})()
