function syncAll(requests, optionalParams = {}) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify(Object.assign({ requests }, optionalParams))
  const option = { credentials: 'include', method: 'POST', headers, body }
  fetch('/sync_api', option).then(res => res.json()).then(syncdata => {
    const vueData = {}
    for (const name in syncdata) {
      const { keys, data } = syncdata[name]
      const query = requests[name].query
      const store = new ARSyncStore(query, data)
      keys.forEach(key => {
        return App.cable.subscriptions.create(
          { channel: "SyncChannel", key },
          { received(patch) { store.update(patch) } }
        )
      })
      vueData[name] = store.data
    }
    new Vue({ el: '#syncbody', data: vueData })
  })
}
