import ArSyncStore from './ArSyncStore'
import ArSyncAPI from '../core/ArSyncApi'
import ArSyncConnectionManager from '../core/ConnectionManager'
import ArSyncModelBase from '../core/ArSyncModelBase'

class ArSyncRecord {
  immutable
  request
  subscriptions
  store
  retryLoadTimer
  data
  bufferTimer
  bufferedPatches
  eventListeners
  networkSubscription
  complete: boolean
  notfound?: boolean
  static connectionManager
  constructor(request, option = {} as { immutable?: boolean }) {
    this.immutable = option.immutable ? true : false
    this.request = request
    this.subscriptions = []
    this.store = null
    this.data = null
    this.complete = false
    this.bufferedPatches = []
    this.eventListeners = { events: {}, serial: 0 }
    this.networkSubscription = ArSyncRecord.connectionManager.subscribeNetwork((status) => {
      if (this.notfound) {
        this.trigger('connection', status)
        return
      }
      if (status) {
        this.load(() => {
          this.trigger('connection', status)
          this.trigger('change', { path: [], value: this.data })
        })
      } else {
        this.unsubscribeAll()
        this.trigger('connection', false)
      }
    })
    this.load(() => {
      this.trigger('load')
      this.trigger('change', { path: [], value: this.data })
    })
  }
  release() {
    this.unsubscribeAll()
    this.networkSubscription.unsubscribe()
  }
  unsubscribeAll() {
    if (this.retryLoadTimer) clearTimeout(this.retryLoadTimer)
    for (const s of this.subscriptions) s.unsubscribe()
    this.subscriptions = []
  }
  load(callback, retryCount = 0) {
    ArSyncAPI.syncFetch(this.request).then(syncData => {
      const { keys, data, limit, order } = syncData as any
      this.initializeStore(keys, data, { limit, order, immutable: this.immutable })
      if (callback) callback(true, this.data)
    }).catch(e => {
      console.error(e)
      if (e.retry) {
        this.retryLoad(callback, retryCount + 1)
      } else {
        this.initializeStore(null, null, null)
        if (callback) callback(false, this.data)
      }
    })
  }
  retryLoad(callback, retryCount) {
    const sleepSeconds = Math.min(Math.pow(2, retryCount), 30)
    this.retryLoadTimer = setTimeout(() => {
      this.retryLoadTimer = null
      this.load(callback, retryCount)
    }, sleepSeconds * 1000)
  }
  patchReceived(patch) {
    const buffer = this.bufferedPatches
    buffer.push(patch)
    if (this.bufferTimer) return
    this.bufferTimer = setTimeout(() => {
      this.bufferTimer = null
      this.bufferedPatches
      const buf = this.bufferedPatches
      this.bufferedPatches = []
      const { changes, events } = this.store.batchUpdate(buf)
      this.data = this.store.data
      changes.forEach(change => this.trigger('change', change))
      events.forEach(event => {
        this.trigger(event.type, event.data)
      })
    }, 16)
  }
  subscribe(event, callback) {
    let listeners = this.eventListeners.events[event]
    if (!listeners) this.eventListeners.events[event] = listeners = {}
    const id = this.eventListeners.serial++
    listeners[id] = callback
    return { unsubscribe: () => { delete listeners[id] } }
  }
  trigger(event, arg?) {
    const listeners = this.eventListeners.events[event]
    if (!listeners) return
    for (const id in listeners) listeners[id](arg)
  }
  initializeStore(keys, data, option) {
    this.complete = true
    if (!keys) {
      this.notfound = true
      return
    }
    this.notfound = false
    const query = this.request.query
    if (this.store) {
      this.store.replaceData(data)
    } else {
      this.store = new ArSyncStore(query, data, option)
      this.data = this.store.data
    }
    this.subscriptions = keys.map(key => {
      return ArSyncRecord.connectionManager.subscribe(key, patch => this.patchReceived(patch))
    })
  }
}

export default class ArSyncModel<T> extends ArSyncModelBase<T> {
  static setConnectionAdapter(adapter) {
    ArSyncRecord.connectionManager = new ArSyncConnectionManager(adapter)
  }
  static createRefModel(request, option) {
    return new ArSyncRecord(request, option)
  }
  refManagerClass() {
    return ArSyncModel
  }
  connectionManager() {
    return ArSyncRecord.connectionManager
  }
  static _cache = {}
  static cacheTimeout = 10 * 1000
}
