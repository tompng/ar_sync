(function(){
function apiBatchFetch(requests) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ requests: requests })
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch('/sync_api', option).then(res => res.json())
}

let batches = []
let batchFetchTimer = null
function apiFetch(request) {
  return new Promise((resolve, reject) => {
    batches.push([request, resolve])
    if (batchFetchTimer) return
    batchFetchTimer = setTimeout(()=>{
      const requests = []
      const callbacks = []
      for (const batch of batches) {
        requests.push(batch[0])
        callbacks.push(batch[1])
      }
      apiBatchFetch(requests).then((result) => {
        for (let i in result) callbacks[i](result[i])
      }).catch(reject)
    }, 16)
  })
}

try {
  module.exports = apiFetch
} catch (e) {
  window.arSyncApiFetch = apiFetch
}


})()
