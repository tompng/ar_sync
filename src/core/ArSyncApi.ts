async function apiBatchFetch(endpoint: string, requests: object[]) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
  const body = JSON.stringify({ requests })
  const option = { credentials: 'include', method: 'POST', headers, body } as const
  if (ArSyncApi.domain) endpoint = ArSyncApi.domain + endpoint
  const res = await fetch(endpoint, option)
  if (res.status === 200) return res.json()
  throw new Error(res.statusText)
}
type FetchError = {
  type: string
  message: string
  retry: boolean
}
interface PromiseCallback {
  resolve: (data: any) => void
  reject: (error: FetchError) => void
}

type Request = { api: string; params?: any; query: any; id?: number }
class ApiFetcher {
  endpoint: string
  batches: [object, PromiseCallback][] = []
  batchFetchTimer: number | null = null
  constructor(endpoint: string) {
    this.endpoint = endpoint
  }
  fetch(request: Request) {
    if (request.id != null) {
      return new Promise((resolve, reject) => {
        this.fetch({ api: request.api, params: { ids: [request.id] }, query: request.query }).then((result: any[]) => {
          if (result[0]) resolve(result[0])
          else reject({ type: 'Not Found', retry: false })
        }).catch(reject)
      })
    }
    return new Promise((resolve, reject) => {
      this.batches.push([request, { resolve, reject }])
      if (this.batchFetchTimer) return
      this.batchFetchTimer = setTimeout(() => {
        this.batchFetchTimer = null
        const compacts: { [key: string]: PromiseCallback[] } = {}
        const requests: object[] = []
        const callbacksList: PromiseCallback[][] = []
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
        ArSyncApi._batchFetch(this.endpoint, requests).then((results) => {
          for (const i in callbacksList) {
            const result = results[i]
            const callbacks = callbacksList[i]
            for (const callback of callbacks) {
              if (result.data !== undefined) {
                callback.resolve(result.data)
              } else {
                const error = result.error || { type: 'Unknown Error' }
                callback.reject({ ...error, retry: false })
              }
            }
          }
        }).catch(e => {
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
const ArSyncApi = {
  domain: null as string | null,
  _batchFetch: apiBatchFetch,
  fetch: (request: Request) => staticFetcher.fetch(request),
  syncFetch: (request: Request) => syncFetcher.fetch(request),
}
export default ArSyncApi
