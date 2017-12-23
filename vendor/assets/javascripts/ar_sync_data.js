class ARSyncData {
  constructor(requests, optionalParams) {
    this.requests = requests
    this.optionalParams = optionalParams
    this.subscriptions = {}
    this.stores = {}
    this.vueData = {}
  }
  release() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe()
    }
    this.subscriptions = {}
  }
  load(callback) {
    this.apiCall().then(syncData => {
      for (const name in syncData) {
        const { keys, data } = syncData[name]
        this.initializeStore(name, keys, data)
      }
    }).then(()=>{
      if (callback) callback(this.vueData)
    })
  }
  initializeStore(name, keys, data) {
    const query = this.requests[name].query
    const store = new ARSyncStore(query, data)
    this.stores[name] = store
    this.vueData[name] = store.data
    this.subscriptions[name] = keys.forEach(key => {
      return App.cable.subscriptions.create(
        { channel: "SyncChannel", key },
        { received(patch) { store.update(patch) } }
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

try { module.exports = ARSyncData } catch (e) {}
