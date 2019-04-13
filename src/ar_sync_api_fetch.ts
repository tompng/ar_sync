function apiBatchFetch(endpoint, requests) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ requests })
  const option = { credentials: 'include', method: 'POST', headers, body } as const
  return fetch(endpoint, option).then(res => {
    if (res.status === 200) return res.json()
    throw new Error(res.statusText)
  })
}

class ApiFetcher {
  endpoint: string
  batches
  batchFetchTimer
  constructor(endpoint: string) {
    this.endpoint = endpoint
    this.batches = []
    this.batchFetchTimer = null
  }
  fetch(request) {
    return new Promise((resolve, reject) => {
      this.batches.push([request, { resolve, reject }])
      if (this.batchFetchTimer) return
      this.batchFetchTimer = setTimeout(()=>{
        this.batchFetchTimer = null
        const compacts = {}
        const requests = []
        const callbacksList = []
        for (const batch of this.batches) {
          const request = batch[0]
          const callback = batch[1]
          const key = JSON.stringify(request)
          if (compacts[key]) {
            compacts[key].push(callback)
          } else {
            requests.push(request)
            callbacksList.push(compacts[key] = [callback])
          }
        }
        this.batches = []
        apiBatchFetch(this.endpoint, requests).then((results) => {
          for (const i in callbacksList) {
            const result = results[i]
            const callbacks = callbacksList[i]
            for (const callback of callbacks) {
              if (result.data) {
                callback.resolve(result.data)
              } else {
                const error = result.error || { type: 'Unknown Error' }
                callback.reject(error)
              }
            }
          }
        }).catch((e) => {
          const error = { type: e.name, message: e.message, retry: true }
          for (const callbacks of callbacksList) {
            for (const callback of callbacks) callback.reject(error)
          }
        })
      }, 16)
    })
  }
}

const staticFetcher = new ApiFetcher('/static_api')
const syncFetcher = new ApiFetcher('/sync_api')
export default {
  fetch: request => staticFetcher.fetch(request),
  syncFetch: request => syncFetcher.fetch(request),
}
