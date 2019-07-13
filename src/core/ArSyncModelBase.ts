interface Request { field: string; params?: any; query?: any }
type Path = (string | number)[]
interface Change { path: Path; value: any }
type ChangeCallback = (change: Change) => void
type LoadCallback = () => void
type ConnectionCallback = (status: boolean) => void
type SubscriptionType = 'load' | 'change' | 'connection'
type SubscriptionCallback = ChangeCallback | LoadCallback | ConnectionCallback
interface Adapter {
  subscribe: (key: string, received: (data: any) => void) => { unsubscribe: () => void }
  ondisconnect: () => void
  onreconnect: () => void
}

export default abstract class ArSyncModelBase<T> {
  private _ref
  private _listenerSerial: number
  private _listeners
  complete: boolean
  notfound?: boolean
  connected: boolean
  data: T | null
  static _cache: { [key: string]: { key: string; count: number; timer: number | null; model } }
  static cacheTimeout: number
  abstract refManagerClass(): any
  abstract connectionManager(): { networkStatus: boolean }
  constructor(request: Request, option?: { immutable: boolean }) {
    this._ref = this.refManagerClass().retrieveRef(request, option)
    this._listenerSerial = 0
    this._listeners = {}
    this.complete = false
    this.connected = this.connectionManager().networkStatus
    const setData = () => {
      this.data = this._ref.model.data
      this.complete = this._ref.model.complete
      this.notfound = this._ref.model.notfound
    }
    setData()
    this.subscribe('load', setData)
    this.subscribe('change', setData)
    this.subscribe('connection', (status: boolean) => {
      this.connected = status
    })
  }
  onload(callback: LoadCallback) {
    this.subscribeOnce('load', callback)
  }
  subscribeOnce(event: SubscriptionType, callback: SubscriptionCallback) {
    const subscription = this.subscribe(event, (arg) => {
      (callback as (arg: any) => void)(arg)
      subscription.unsubscribe()
    })
    return subscription
  }
  subscribe(event: SubscriptionType, callback: SubscriptionCallback): { unsubscribe: () => void } {
    const id = this._listenerSerial++
    const subscription = this._ref.model.subscribe(event, callback)
    let unsubscribed = false
    const unsubscribe = () => {
      unsubscribed = true
      subscription.unsubscribe()
      delete this._listeners[id]
    }
    if (this.complete) {
      if (event === 'load') setTimeout(() => {
        if (!unsubscribed) (callback as LoadCallback)()
      }, 0)
      if (event === 'change') setTimeout(() => {
        if (!unsubscribed) (callback as ChangeCallback)({ path: [], value: this.data })
      }, 0)
    }
    return this._listeners[id] = { unsubscribe }
  }
  release() {
    for (const id in this._listeners) this._listeners[id].unsubscribe()
    this._listeners = {}
    this.refManagerClass()._detach(this._ref)
    this._ref = null
  }
  static retrieveRef(
    request: Request,
    option?: { immutable: boolean }
  ): { key: string; count: number; timer: number | null; model } {
    const key = JSON.stringify([request, option])
    let ref = this._cache[key]
    if (!ref) {
      const model = this.createRefModel(request, option)
      ref = this._cache[key] = { key, count: 0, timer: null, model }
    }
    this._attach(ref)
    return ref
  }
  static createRefModel(_request: Request, _option?: { immutable: boolean }) {
    throw 'abstract method'
  }
  static _detach(ref) {
    ref.count--
    const timeout = this.cacheTimeout
    if (ref.count !== 0) return
    const timedout = () => {
      ref.model.release()
      delete this._cache[ref.key]
    }
    if (timeout) {
      ref.timer = setTimeout(timedout, timeout)
    } else {
      timedout()
    }
  }
  private static _attach(ref) {
    ref.count++
    if (ref.timer) clearTimeout(ref.timer)
  }
  static setConnectionAdapter(_adapter: Adapter) {}
  static waitForLoad(...models: ArSyncModelBase<{}>[]) {
    return new Promise((resolve) => {
      let count = 0
      for (const model of models) {
        model.onload(() => {
          count++
          if (models.length == count) resolve(models)
        })
      }
    })
  }
}
