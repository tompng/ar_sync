import ArSyncAPI from '../ar_sync_api_fetch'

const ModelBatchRequest = {
  timer: null,
  apiRequests: {} as {
    [api: string]: {
      [queryJSON: string]: {
        query
        requests: {
          [id: number]: {
            id: number
            model?
            callbacks: ((model) => void)[]
          }
        }
      }
    }
  },
  fetch(api, query, id) {
    this.setTimer()
    return new Promise(resolve => {
      const queryJSON = JSON.stringify(query)
      const apiRequest = this.apiRequests[api] = this.apiRequests[api] || {}
      const queryRequests = apiRequest[queryJSON] = apiRequest[queryJSON] || { query, requests: {} }
      const request = queryRequests.requests[id] = queryRequests.requests[id] || { id, callbacks: [] }
      request.callbacks.push(resolve)
    })
  },
  batchFetch() {
    const { apiRequests } = this as typeof ModelBatchRequest
    for (const api in apiRequests) {
      const apiRequest = apiRequests[api]
      for (const { query, requests } of Object.values(apiRequest)) {
        const ids = Object.values(requests).map(({ id }) => id)
        ArSyncAPI.syncFetch({ api, query, params: { ids } }).then((models: any[]) => {
          for (const model of models) requests[model.id].model = model
          for (const { model, callbacks } of Object.values(requests)) {
            for (const callback of callbacks) callback(model)
          }
        })
      }
    }
    this.apiRequests = {}
  },
  setTimer() {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.batchFetch()
    }, 20)
  }
}

class ArSyncContainerBase {
  data
  listeners
  networkSubscriber
  parentModel
  parentKey
  children: ArSyncContainerBase[]
  onConnectionChange
  constructor() {
    this.listeners = []
  }
  replaceData(_data, _sync_keys?) {}
  initForReload(request) {
    this.networkSubscriber = ArSyncStore.connectionManager.subscribeNetwork((state) => {
      if (state) {
        ArSyncAPI.syncFetch(request).then(data => {
          if (this.data) {
            this.replaceData(data)
            if (this.onConnectionChange) this.onConnectionChange(true)
            if (this.onChange) this.onChange([], this.data)
          }
        })
      } else {
        if (this.onConnectionChange) this.onConnectionChange(false)
      }
    })
  }
  release() {
    if (this.networkSubscriber) this.networkSubscriber.unsubscribe()
    this.unsubscribeAll()
    for (const child of Object.values(this.children)) {
      if (child) child.release()
    }
    this.data = null
  }
  onChange(path, data) {
    if (this.parentModel) this.parentModel.onChange([this.parentKey, ...path], data)
  }
  subscribe(key, listener) {
    this.listeners.push(ArSyncStore.connectionManager.subscribe(key, listener))
  }
  unsubscribeAll() {
    for (const l of this.listeners) l.unsubscribe()
    this.listeners = []
  }
  static parseQuery(query, attrsonly = false){
    const attributes = {}
    let column = null
    let params = null
    if (!query) query = []
    if (query.constructor !== Array) query = [query]
    for (const arg of query) {
      if (typeof(arg) === 'string') {
        attributes[arg] = {}
      } else if (typeof(arg) === 'object') {
        for (const key in arg){
          const value = arg[key]
          if (attrsonly) {
            attributes[key] = this.parseQuery(value)
            continue
          }
          if (key === 'attributes') {
            const child = this.parseQuery(value, true)
            for (const k in child) attributes[k] = child[k]
          } else if (key === 'as') {
            column = value
          } else if (key === 'params') {
            params = value
          } else {
            attributes[key] = this.parseQuery(value)
          }
        }
      }
    }
    if (attrsonly) return attributes
    return { attributes, as: column, params }
  }
  static _load({ api, id, params, query }, root) {
    const parsedQuery = ArSyncRecord.parseQuery(query)
    if (id) {
      return ModelBatchRequest.fetch(api, query, id).then(data => new ArSyncRecord(parsedQuery, data[0], null, root))
    } else {
      const request = { api, query, params }
      return ArSyncAPI.syncFetch(request).then((response: any) => {
        if (response.collection && response.order) {
          return new ArSyncCollection(response.sync_keys, 'collection', parsedQuery, response, request, root)
        } else {
          return new ArSyncRecord(parsedQuery, response, request, root)
        }
      })
    }
  }
  static load(apiParams, root) {
    if (!(apiParams instanceof Array)) return this._load(apiParams, root)
    return new Promise((resolve, _reject) => {
      const resultModels: any[] = []
      let countdown = apiParams.length
      apiParams.forEach((param, i) => {
        this._load(param, root).then(model => {
          resultModels[i] = model
          countdown --
          if (countdown === 0) resolve(resultModels)
        })
      })
    })
  }
}

class ArSyncRecord extends ArSyncContainerBase {
  id
  root
  query
  data
  children
  sync_keys
  paths
  reloadQueryCache
  constructor(query, data, request, root) {
    super()
    this.root = root
    if (request) this.initForReload(request)
    this.query = query
    this.data = {}
    this.children = {}
    this.replaceData(data)
  }
  setSyncKeys(sync_keys) {
    this.sync_keys = sync_keys
    if (!this.sync_keys) {
      this.sync_keys = []
      console.error('warning: no sync_keys')
    }
  }
  replaceData(data) {
    this.setSyncKeys(data.sync_keys)
    this.unsubscribeAll()
    if (this.data.id !== data.id) {
      this.mark()
      this.data.id = data.id
    }
    this.paths = []
    for (const key in this.query.attributes) {
      const subQuery = this.query.attributes[key]
      const aliasName = subQuery.as || key
      const subData = data[aliasName]
      if (key === 'sync_keys') continue
      if (subQuery.attributes && subQuery.attributes.sync_keys) {
        if (subData instanceof Array || (subData && subData.collection && subData.order)) {
          if (this.children[aliasName]) {
            this.children[aliasName].replaceData(subData, this.sync_keys)
          } else {
            const collection = new ArSyncCollection(this.sync_keys, key, subQuery, subData, null, this.root)
            this.mark()
            this.children[aliasName] = collection
            this.data[aliasName] = collection.data
            collection.parentModel = this
            collection.parentKey = aliasName
          }
        } else {
          this.paths.push(key)
          if (subData) {
            if (this.children[aliasName]) {
              this.children[aliasName].replaceData(subData)
            } else {
              const model = new ArSyncRecord(subQuery, subData, null, this.root)
              this.mark()
              this.children[aliasName] = model
              this.data[aliasName] = model.data
              model.parentModel = this
              model.parentKey = aliasName
            }
          } else {
            if(this.children[aliasName]) this.children[aliasName].release()
            delete this.children[aliasName]
            if (this.data[aliasName]) {
              this.mark()
              this.data[aliasName] = null
            }
          }
        }
      } else {
        if (this.data[aliasName] !== subData) {
          this.mark()
          this.data[aliasName] = subData
        }
      }
    }
    this.subscribeAll()
  }
  onNotify(notifyData, path?) {
    const { action, class_name, id } = notifyData
    if (action === 'remove') {
      this.children[path].release()
      this.children[path] = null
      this.mark()
      this.data[path] = null
      this.onChange([path], null)
    } else if (action === 'add') {
      if (this.data.id === id) return
      const query = this.query.attributes[path]
      ModelBatchRequest.fetch(class_name, query, id).then(data => {
        if (!data) return
        const model = new ArSyncRecord(query, data, null, this.root)
        if (this.children[path]) this.children[path].release()
        this.children[path] = model
        this.mark()
        this.data[path] = model.data
        model.parentModel = this
        model.parentKey = path
        this.onChange([path], model.data)
      })
    } else {
      ModelBatchRequest.fetch(class_name, this.reloadQuery(), id).then(data => {
        this.update(data)
      })
    }
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
    for (const key of this.sync_keys) {
      this.subscribe(key, callback)
    }
    for (const path of this.paths) {
      const pathCallback = data => this.onNotify(data, path)
      for (const key of this.sync_keys) this.subscribe(key + path, pathCallback)
    }
  }
  reloadQuery() {
    if (this.reloadQueryCache) return this.reloadQueryCache
    const reloadQuery = this.reloadQueryCache = { attributes: [] as any[] }
    for (const key in this.query.attributes) {
      if (key === 'sync_keys') continue
      const val = this.query.attributes[key]
      if (!val || !val.attributes || !val.attributes.sync_keys) reloadQuery.attributes.push(key)
    }
    return reloadQuery
  }
  update(data) {
    for (const key in data) {
      if (this.data[key] === data[key]) continue
      this.mark()
      this.data[key] = data[key]
      this.onChange([key], data[key])
    }
  }
  markAndSet(key, data) {
    this.mark()
    this.data[key] = data
  }
  mark() {
    if (!this.root || !this.root.immutable || !Object.isFrozen(this.data)) return
    this.data = { ...this.data }
    this.root.mark(this.data)
    if (this.parentModel) this.parentModel.markAndSet(this.parentKey, this.data)
  }
  onChange(path, data) {
    if (this.parentModel) this.parentModel.onChange([this.parentKey, ...path], data)
  }
}
class ArSyncCollection extends ArSyncContainerBase {
  root
  path
  order
  query
  data
  children
  sync_keys
  constructor(sync_keys, path, query, data, request, root){
    super()
    this.root = root
    this.path = path
    if (request) this.initForReload(request)
    if (query.params && (query.params.order || query.params.limit)) {
      this.order = { limit: query.params.limit, mode: query.params.order || 'asc' }
    } else {
      this.order = { limit: null, mode: 'asc' }
    }
    this.query = query
    this.data = []
    this.children = []
    this.replaceData(data, sync_keys)
  }
  setSyncKeys(sync_keys) {
    if (sync_keys) {
      this.sync_keys = sync_keys.map(key => key + this.path)
    } else {
      console.error('warning: no sync_keys')
      this.sync_keys = []
    }
  }
  replaceData(data, sync_keys) {
    this.setSyncKeys(sync_keys)
    const existings = {}
    for (const child of this.children) existings[child.data.id] = child
    let collection
    if (data.collection && data.order) {
      collection = data.collection
      this.order = data.order
    } else {
      collection = data
    }
    const newChildren: any[] = []
    const newData: any[] = []
    for (const subData of collection) {
      let model = existings[subData.id]
      if (model) {
        model.replaceData(subData)
      } else {
        model = new ArSyncRecord(this.query, subData, null, this.root)
        model.parentModel = this
        model.parentKey = subData.id
      }
      newChildren.push(model)
      newData.push(model.data)
    }
    while (this.children.length) {
      const child = this.children.pop()
      if (!existings[child.data.id]) child.release()
    }
    if (this.data.length || newChildren.length) this.mark()
    while (this.data.length) this.data.pop()
    for (const child of newChildren) this.children.push(child)
    for (const el of newData) this.data.push(el)
    this.subscribeAll()
  }
  consumeAdd(className, id) {
    if (this.data.findIndex(a => a.id === id) >= 0) return
    if (this.order.limit === this.data.length) {
      if (this.order.mode === 'asc') {
        const last = this.data[this.data.length - 1]
        if (last && last.id < id) return
      } else {
        const last = this.data[this.data.length - 1]
        if (last && last.id > id) return
      }
    }
    ModelBatchRequest.fetch(className, this.query, id).then((data) => {
      if (!data) return
      const model = new ArSyncRecord(this.query, data, null, this.root)
      model.parentModel = this
      model.parentKey = id
      const overflow = this.order.limit && this.order.limit === this.data.length
      let rmodel
      this.mark()
      if (this.order.mode === 'asc') {
        const last = this.data[this.data.length - 1]
        this.children.push(model)
        this.data.push(model.data)
        if (last && last.id > id) {
          this.children.sort((a, b) => a.data.id < b.data.id ? -1 : +1)
          this.data.sort((a, b) => a.id < b.id ? -1 : +1)
        }
        if (overflow) {
          rmodel = this.children.shift()
          rmodel.release()
          this.data.shift()
        }
      } else {
        const first = this.data[0]
        this.children.unshift(model)
        this.data.unshift(model.data)
        if (first && first.id > id) {
          this.children.sort((a, b) => a.data.id > b.data.id ? -1 : +1)
          this.data.sort((a, b) => a.id > b.id ? -1 : +1)
        }
        if (overflow) {
          rmodel = this.children.pop()
          rmodel.release()
          this.data.pop()
        }
      }
      this.onChange([model.id], model.data)
      if (rmodel) this.onChange([rmodel.id], null)
    })
  }
  consumeRemove(id) {
    const idx = this.data.findIndex(a => a.id === id)
    if (idx < 0) return
    this.mark()
    this.children[idx].release()
    this.children.splice(idx, 1)
    this.data.splice(idx, 1)
    this.onChange([id], null)
  }
  onNotify(notifyData) {
    if (notifyData.action === 'add') {
      this.consumeAdd(notifyData.class_name, notifyData.id)
    } else if (notifyData.action === 'remove') {
      this.consumeRemove(notifyData.id)
    }
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
    for (const key of this.sync_keys) this.subscribe(key, callback)
  }
  markAndSet(id, data) {
    this.mark()
    const idx = this.data.findIndex(a => a.id === id)
    if (idx >= 0) this.data[idx] = data
  }
  mark() {
    if (!this.root || !this.root.immutable || !Object.isFrozen(this.data)) return
    this.data = [...this.data]
    this.root.mark(this.data)
    if (this.parentModel) this.parentModel.markAndSet(this.parentKey, this.data)
  }
}

export default class ArSyncStore {
  immutable
  markedForFreezeObjects
  changes
  eventListeners
  markForRelease
  container
  data
  loaded
  changesBufferTimer
  static connectionManager
  constructor(request, { immutable } = {} as { immutable?: boolean }) {
    this.immutable = immutable
    this.markedForFreezeObjects = []
    this.changes = []
    this.eventListeners = { events: {}, serial: 0 }
    ArSyncContainerBase.load(request, this).then((container: ArSyncContainerBase) => {
      if (this.markForRelease) {
        container.release()
        return
      }
      this.container = container
      this.data = container.data
      if (immutable) this.freezeRecursive(this.data)
      this.trigger('load')
      this.trigger('change', { path: [], value: this.data })
      container.onChange = (path, value) => {
        this.changes.push({ path, value })
        this.setChangesBufferTimer()
      }
      container.onConnectionChange = state => {
        this.trigger(state ? 'reconnect' : 'disconnect')
      }
      this.loaded = true
    })
  }
  setChangesBufferTimer() {
    if (this.changesBufferTimer) return
    this.changesBufferTimer = setTimeout(() => {
      this.changesBufferTimer = null
      const changes = this.changes
      this.changes = []
      this.freezeMarked()
      this.data = this.container.data
      changes.forEach(patch => this.trigger('change', patch))
    }, 20)
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
  mark(object) {
    this.markedForFreezeObjects.push(object)
  }
  freezeRecursive(obj) {
    if (Object.isFrozen(obj)) return obj
    for (const key in obj) this.freezeRecursive(obj[key])
    Object.freeze(obj)
  }
  freezeMarked() {
    this.markedForFreezeObjects.forEach(obj => this.freezeRecursive(obj))
    this.markedForFreezeObjects = []
  }
  release() {
    if (this.changesBufferTimer) clearTimeout(this.changesBufferTimer)
    if (this.container) {
      this.container.release()
    } else {
      this.markForRelease = true
    }
  }
}
