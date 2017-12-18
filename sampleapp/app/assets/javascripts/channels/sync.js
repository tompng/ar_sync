function sync(url, query) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ query })
  const option = { credentials: 'include', method: 'POST', headers, body }
  fetch(url, option).then(res => res.json()).then(syncdata => {
    const el = document.querySelector('.vue-root')
    syncdata.data.currentUser = JSON.parse(document.querySelector('#current_user').value)
    const store = new ARSyncStore(query, syncdata.data)
    syncdata.keys.map(key => {
      return App.cable.subscriptions.create(
        { channel: "SyncChannel", key },
        { received(patch) { store.update(patch) } }
      )
    })
    new Vue({ el: '#syncbody', data: store.data })
  })
}
