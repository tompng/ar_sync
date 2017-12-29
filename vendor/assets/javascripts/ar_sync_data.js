class ARSyncData {
  constructor(requests, option = {}, optionalParams) {
    this.requests = requests
    this.optionalParams = optionalParams
    this.subscriptions = {}
    this.stores = {}
    this.data = {}
    this.bufferedPatches = {}
    this.connectionState = { connections: {}, connected: 0, count: 0, needsReload: false }
  }
  immutable() { return false }
  release() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe()
    }
    this.subscriptions = {}
  }
  load(callback) {
    this.apiCall().then(syncData => {
      let count = 0
      for (const name in syncData) {
        count += syncData[name].keys.length
      }
      this.connectionState.count = count
      for (const name in syncData) {
        const { keys, data, limit, order } = syncData[name]
        this.initializeStore(name, keys, data, { limit, order, immutable: this.immutable() })
      }
    }).then(()=>{
      if (callback) callback(this.data)
    })
    return this
  }
  changed(callback) {
    this.changedCallback = callback
    return this
  }
  patchReceived(name, patch) {
    const buffer = this.bufferedPatches
    ;(buffer[name] = buffer[name] || []).push(patch)
    if (this.bufferTimer) return
    this.bufferTimer = setTimeout(() => {
      this.bufferTimer = null
      const buf = this.bufferedPatches
      this.bufferedPatches = {}
      const changes = {}
      for (const name in buf) {
        changes[name] = this.stores[name].batchUpdate(buf[name])
      }
      if (this.immutable()) {
        this.data = {}
        for (const name in this.stores) {
          this.data[name] = this.stores[name].data
        }
      }
      if (this.changedCallback) this.changedCallback(changes)
    }, 20)
  }
  reconnected(callback) {
    this.reconnectedCallback = callback
  }
  disconnected(callback) {
    this.disconnectedCallback = callback
  }
  subscriptionDisconnected(name) {
    const state = this.connectionState
    if (!state.connections[name]) return
    state.connections[name] = false
    state.connected--
    if (!state.needsReload) {
      state.needsReload = true
      if (this.disconnectedCallback) this.disconnectedCallback()
    }
  }
  subscriptionConnected(name) {
    const state = this.connectionState
    if (state.connections[name]) return
    state.connections[name] = true
    state.connected++
    if (state.needsReload && state.connected === state.count) {
      state.needsReload = false
      this.load(() => {
        if (this.reconnectedCallback) this.reconnectedCallback()
        if (this.changedCallback) this.changedCallback()
      })
    }
  }
  initializeStore(name, keys, data, option) {
    const query = this.requests[name].query
    const prevStore = this.stores[name]
    if (prevStore) {
      prevStore.replaceData(data)
      return
    }
    const store = new ARSyncStore(query, data, option)
    this.stores[name] = store
    this.data[name] = store.data
    let timer
    let patches = []
    const received = patch => this.patchReceived(name, patch)
    this.subscriptions[name] = keys.forEach(key => {
      const connectionName = name + '/' + key
      const disconnected = () => this.subscriptionDisconnected(connectionName)
      const connected = () => this.subscriptionConnected(connectionName)
      return App.cable.subscriptions.create(
        { channel: "SyncChannel", key },
        { received, disconnected, connected }
      )
    })
  }
  apiCall() {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
    const body = JSON.stringify(Object.assign({ requests: this.requests }, this.optionalParams))
    const option = { credentials: 'include', method: 'POST', headers, body }
    return fetch('/sync_api', option).then(res => res.json())
  }
}

class ARSyncImmutableData extends ARSyncData {
  immutable() { return true }
}
