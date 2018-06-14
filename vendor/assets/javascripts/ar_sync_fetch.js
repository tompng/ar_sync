(function(){
function apiBatchFetch(endpoint, requests) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ requests })
  const option = { credentials: 'include', method: 'POST', headers, body }
  return fetch(endpoint, option).then(res => {
    if (res.status === 200) return res.json()
    throw new Error(res.statusText)
  })
}

class ApiFetcher {
  constructor(endpoint) {
    this.endpoint = endpoint
    this.reset()
  }
  reset() {
    this.batchFetchTimer = null
    this.requests = []
    this.callbacks = []
    this.paramsRequestCallbacks = {}
    this.idRequests = {}
  }
  storeRequest(request, resolve, reject) {
    if (request.id) {
      this.storeIdRequest(request, resolve, reject)
    } else {
      this.storeParamsRequest(request, resolve, reject)
    }
  }
  storeParamsRequest(request, resolve, reject) {
    const key = JSON.stringify(request)
    if (!this.paramsRequestCallbacks[key]) {
      const callbacks = []
      this.paramsRequestCallbacks[key] = callbacks
      this.requests.push(request)
      this.callbacks.push({
        resolve: response => callbacks.forEach(cb => cb.resolve(response)),
        reject: error => callbacks.forEach(cb => cb.reject(error))
      })
    }
    this.paramsRequestCallbacks[key].push({ resolve, reject })
  }
  storeIdRequest({ api, query, id }, resolve, reject) {
    const key = JSON.stringify([api, query])
    let idinfo = this.idRequests[key]
    if (!idinfo) {
      const idCallbacks = {}
      const ids = []
      idinfo = { idCallbacks, ids }
      this.idRequests[key] = idinfo
      this.requests.push({ api, query, params: ids })
      this.callbacks.push({
        resolve: response => {
          response.forEach(model => {
            idCallbacks[model.id].forEach(cb => cb.resolve(model))
          })
        },
        reject: error => {
          for (const callbacks of idCallbacks) {
            callbacks.forEach(cb => cb.reject(error))
          }
        }
      })
    }
    if (!idinfo.idCallbacks[id]) {
      idinfo.idCallbacks[id] = []
      idinfo.ids.push(id)
    }
    idinfo.idCallbacks[id].push({ resolve, reject })
  }
  sendRequests() {
    const requests = this.requests
    const callbacks = this.callbacks
    this.reset()
    apiBatchFetch(this.endpoint, requests).then(results => {
      for (const i in results) {
        const result = results[i]
        if (result.error) {
          callbacks[i].reject(result.error)
        } {
          callbacks[i].resolve(result.data)
        }
      }
    }).catch((e) => {
      this.callbacks.forEach(cb => cb.reject({ type: e.name, message: e.message }))
    })
  }
  fetch(request) {
    return new Promise((resolve, reject) => {
      this.storeRequest(request, resolve, reject)
      if (this.batchFetchTimer) return
      this.batchFetchTimer = setTimeout(() => this.sendRequests(), 16)
    })
  }
}

const fetcher = new ApiFetcher('/sync_api')
window.fetcher = fetcher
const apifetch = request => fetcher.fetch(request)
try {
  module.exports = apifetch
} catch (e) {
  window.fetchSyncAPI = apifetch
}
})()
