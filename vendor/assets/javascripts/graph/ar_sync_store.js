(function(){
let ArSyncAPI, ArSyncConnectionManager
try {
  ArSyncAPI = require('./ar_sync_api_fetch')
  ArSyncConnectionManager = require('./ar_sync_connection_manager')
} catch(e) {
  ArSyncAPI = window.ArSyncAPI
  ArSyncConnectionManager = window.ArSyncConnectionManager
}

class ArSyncContainerBase {
  constructor() {
    this.listeners = []
  }
  initForReload(request) {
    this.networkSubscriber = ArSyncStore.connectionManager.subscribeNetwork((state) => {
      if (state) {
        ArSyncAPI.syncFetch(request).then(data => {
          if (this.data) {
            this.replaceData(data)
            if (this.onConnectionChange) this.onConnectionChange(true)
            if (this.onChange) this.onChange({ path: [], value: this.data })
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
    this.eachChild(child => child.release())
    this.data = null
  }
  subscribe(key, listener) {
    this.listeners.push(ArSyncStore.connectionManager.subscribe(key, listener))
  }
  unsubscribeAll() {
    for (const l of this.listeners) l.unsubscribe()
    this.listeners = []
  }
  static parseQuery(query, attrsonly){
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
      return ArSyncAPI.syncFetch({ api, id, query }).then(data => new ArSyncRecord(parsedQuery, data, null, root))
    } else {
      const request = { api, query, params }
      return ArSyncAPI.syncFetch(request).then(response => {
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
      const resultModels = []
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
  constructor(query, data, request, root) {
    super()
    this.root = root
    if (request) this.initForReload(request)
    this.query = query
    this.data = {}
    this.children = {}
    this.sync_keys = data.sync_keys
    if (!this.sync_keys) {
      this.sync_keys = []
      console.error('warning: no sync_keys')
    }
    this.replaceData(data)
  }
  replaceData(data) {
    this.unsubscribeAll()
    this.data.id = data.id
    this.paths = []
    for (const key in this.query.attributes) {
      const subQuery = this.query.attributes[key]
      const aliasName = subQuery.as || key
      const subData = data[aliasName]
      if (key === 'sync_keys') continue
      if (subQuery.attributes && subQuery.attributes.sync_keys) {
        if (subData instanceof Array || (subData && subData.collection && subData.order)) {
          if (this.children[aliasName]) {
            this.children[aliasName].replaceData(subData)
          } else {
            const collection = new ArSyncCollection(this.sync_keys, key, subQuery, subData, null, this.root)
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
              this.children[aliasName] = model
              this.data[aliasName] = model.data
              model.parentModel = this
              model.parentKey = aliasName
            }
          } else {
            if(this.children[aliasName]) this.children[aliasName].release()
            delete this.children[aliasName]
            this.data[aliasName] = null
          }
        }
      } else {
        this.data[aliasName] = subData
      }
    }
    this.subscribeAll()
  }
  eachChild(callback) {
    for (const key in this.children) callback(this.children[key])
  }
  onNotify(notifyData, path) {
    const { action, class_name, id } = notifyData
    if (action === 'remove') {
      this.children[path].release()
      this.children[path] = null
      this.mark()
      this.data[path] = null
      if (this.parentModel) this.parentModel.onChange([this.parentKey, path], null)
    } else if (action === 'add') {
      if (this.data.id === id) return
      const query = this.query.attributes[path]
      ArSyncAPI.syncFetch({ api: class_name, id, query }).then((data) => {
        const model = new ArSyncRecord(query, data, null, this.root)
        if (this.children[path]) this.children[path].release()
        this.children[path] = model
        this.mark()
        this.data[path] = model.data
        model.parentModel = this
        model.parentKey = path
        if (this.parentModel) this.parentModel.onChange([this.parentKey, path], model.data)
      })
    } else {
      ArSyncAPI.syncFetch({ api: class_name, id, query: this.reloadQuery() }).then((data) => {
        this.update(data)
      })
    }
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
    for (const key of this.sync_keys) this.subscribe(key, callback)
    for (const path of this.paths) {
      const pathCallback = data => this.onNotify(data, path)
      for (const key of this.sync_keys) this.subscribe(key + path, pathCallback)
    }
  }
  reloadQuery() {
    if (this.reloadQueryCache) return this.reloadQueryCache
    const reloadQuery = this.reloadQueryCache = { attributes: [] }
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
      if (this.parentModel) this.parentModel.onChange([this.parentKey, key], data[key])
    }
  }
  set(key, data) {
    this.data[key] = data
  }
  mark() {
    if (!this.root || !this.root.immutable || this.data._marked) return
    this.data = { ...this.data, _marked: true }
    this.root.mark(this.data)
    if (this.parentModel) this.parentModel.mark().set(this.parentKey, this.data)
  }
}
class ArSyncCollection extends ArSyncContainerBase {
  constructor(sync_keys, path, query, data, request, root){
    super()
    this.root = root
    if (request) this.initForReload(request)
    if (sync_keys) {
      this.sync_keys = sync_keys.map(key => key + path)
    } else {
      console.error('warning: no sync_keys')
      this.sync_keys = []
    }
    if (query.params && (query.params.order || query.params.limit)) {
      this.order = { limit: query.params.limit, mode: query.params.order || 'asc' }
    } else {
      this.order = { limit: null, mode: 'asc' }
    }
    this.query = query
    this.data = []
    this.children = []
    this.replaceData(data)
  }
  replaceData(data) {
    const existings = {}
    for (const child of this.children) existings[child.data.id] = child
    let collection
    if (data.collection && data.order) {
      collection = data.collection
      this.order = data.order
    } else {
      collection = data
    }
    const newChildren = []
    const newData = []
    for (const subData of collection) {
      let model = existings[subData.id]
      if (model) {
        model.replaceData(subData)
      } else {
        model = new ArSyncRecord(this.query, subData, null, this.root)
        model.parentModel = this
        model.parentKey = model.id
      }
      newChildren.push(model)
      newData.push(model.data)
    }
    while (this.children.length) {
      const child = this.children.pop()
      if (!existings[child.data.id]) child.release()
    }
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
    ArSyncAPI.syncFetch({ api: className, id, query: this.query }).then((data) => {
      const model = new ArSyncRecord(this.query, data, null, this.root)
      model.parent = this
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
        if (this.parentModel) this.parentModel.onChange([this.parentKey, id], model.data)
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
      if (this.parentModel) {
        this.parentModel.onChange([this.parentKey, model.id], model.data)
        if (rmodel) this.parentModel.onChange([this.parentKey, rmodel.id], null)
      }
    })
  }
  consumeRemove(id) {
    const idx = this.data.findIndex(a => a.id === id)
    if (idx < 0) return
    this.mark()
    this.children[idx].release()
    this.children.splice(idx, 1)
    this.data.splice(idx, 1)
    if (this.parentModel) this.parentModel.onChange([this.parentKey, id], null)
  }
  onNotify(notifyData) {
    if (notifyData.action === 'add') {
      this.consumeAdd(notifyData.class_name, notifyData.id)
    } else if (notifyData.action === 'remove') {
      this.consumeRemove(notifyData.id)
    }
  }
  onChange(path, data) {
    if (this.parentModel) this.parentModel.onChange([this.parentKey, ...path], data)
  }
  eachChild(callback) {
    for (const child of this.children) callback(child)
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
    for (const key of this.sync_keys) this.subscribe(key, callback)
  }
  set(id, data) {
    const idx = this.data.findIndex(a => a.id === id)
    if (idx >= 0) this.data[idx] = data
  }
  mark() {
    if (!this.root || !this.root.immutable || this.data._marked) return
    this.data = [...this.data]
    this.data._marked = true
    this.root.mark(this.data)
    if (this.parentModel) this.parentModel.mark().set(this.parentKey, this.data)
  }
}

class ArSyncStore {
  constructor(request, { immutable } = {}) {
    this.immutable = immutable
    this.markedObjects = []
    this.changes = []
    this.eventListeners = { events: {}, serial: 0 }
    ArSyncContainerBase.load(request, this).then(container => {
      if (this.markForRelease) {
        container.release()
        return
      }
      this.container = container
      this.data = container.data
      this.freezeRecursive(this.data)
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
  trigger(event, arg) {
    const listeners = this.eventListeners.events[event]
    if (!listeners) return
    for (const id in listeners) listeners[id](arg)
  }
  mark(object) {
    this.markedObjects.push(object)
  }
  freezeRecursive(obj) {
    if (Object.isFrozen(obj)) return obj
    if (obj._marked) delete obj.marked
    for (const key in obj) this.freezeRecursive(obj[key])
    Object.freeze(obj)
  }
  freezeMarked() {
    this.markedObjects.forEach(obj => this.freezeRecursive(obj))
    this.markedObjects = []
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

try {
  module.exports = { ArSyncRecord, ArSyncCollection, ArSyncStore }
} catch (e) {
  window.ArSyncCollection = ArSyncCollection
  window.ArSyncRecord = ArSyncRecord
  window.ArSyncStore = ArSyncStore
}
})()
