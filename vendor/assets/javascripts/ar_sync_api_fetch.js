(function(){
function apiBatchFetch(endpoint, requests) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ requests })
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch(endpoint, option).then(res => res.json())
}

class ApiFetcher {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.batches = []
    this.batchFetchTimer = null
  }
  fetch(request) {
    return new Promise((resolve, reject) => {
      this.batches.push([request, resolve])
      if (this.batchFetchTimer) return
      this.batchFetchTimer = setTimeout(()=>{
        this.batchFetchTimer = null
        const compacts = {}
        const requests = []
        const callbacks = []
        for (const batch of this.batches) {
          const request = batch[0]
          const callback = batch[1]
          const key = JSON.stringify(request)
          if (compacts[key]) {
            compacts[key].push(callback)
          } else {
            requests.push(request)
            callbacks.push(compacts[key] = [callback])
          }
        }
        this.batches = []
        apiBatchFetch(this.endpoint, requests).then((result) => {
          for (let i in result) {
            for (const callback of callbacks[i]) callback(result[i])
          }
        }).catch(reject)
      }, 16)
    })
  }
}

const staticFetcher = new ApiFetcher('/static_api')
const syncFetcher = new ApiFetcher('/sync_api')
const ArSyncAPI = {
  fetch: request => staticFetcher.fetch(request),
  syncFetch: request => syncFetcher.fetch(request),
}
try {
  module.exports = ArSyncAPI
} catch (e) {
  window.ArSyncAPI = ArSyncAPI
}
})()
