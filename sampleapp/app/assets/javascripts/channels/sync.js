document.addEventListener('turbolinks:load', ()=>{


})

let currentView
function syncStart(url, query) {
  if (currentView) currentView.$destroy()
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ query })
  const option = { credentials: 'include', method: 'POST', headers, body }
  fetch(url, option).then(res => res.json()).then(syncdata => {
    const el = document.querySelector('.vue-root')
    // el.style.display = 'block'
    // console.error(`<div>${el.innerHTML}</div>`)
    currentView = new Vue({ el: '#syncbody', data: syncdata.data })//, template: `<div>${el.innerHTML}</div>` })
  })
}
App.sync = App.cable.subscriptions.create({
    channel: "SyncChannel",
    key: 'aaa',
  },
  {
    connected: function() {
      console.error('connected')
    },

    disconnected: function() {
      console.error('disconnected')
    },

    received: function(data) {
      console.error('receive', data)
    }
  }
)
