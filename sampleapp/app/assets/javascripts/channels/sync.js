document.addEventListener('turbolinks:load', ()=>{


})

let currentSync = {}
function syncStart(url, query) {
  if (currentSync.vm) currentSync.vm.$destroy()
  if (currentSync.subscriptions) currentSync.subscriptions.forEach(a => a.unsubscribe())
  currentSync = {}
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
    currentSync.subscriptions = syncdata.keys.map(key => {
      return App.cable.subscriptions.create(
        { channel: "SyncChannel", key },
        { received(patch) { store.update(patch) } }
      )
    })
    currentSync.vm = new Vue({ el: '#syncbody', data: store.data })
  })
}
