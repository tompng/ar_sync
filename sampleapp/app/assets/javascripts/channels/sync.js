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
    const store = new ARSyncStore(null, query, syncdata.data)
    currentSync.subscriptions = syncdata.keys.map(key => {
      return App.cable.subscriptions.create(
        { channel: "SyncChannel", key: key },
        patch => store.update(patch.action, patch.path, patch.data)
      )
    })
    currentSync.vm = new Vue({ el: '#syncbody', data: store.data })
  })
}
