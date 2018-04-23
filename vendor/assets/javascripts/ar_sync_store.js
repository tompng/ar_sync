(function(){

const SyncBatchLoader = {
  processing: false,
  batch: [],
  fetch(api, id, query) {
    return new Promise((resolve, _reject) => {
      this.batch.push({ api, id, query, callback: resolve })
      if (!this.processing) {
        this.processing = true
        setTimeout(() => this.process(), 16)
      }
    })
  },
  process() {
    const grouped = {}
    callbacks = {}
    for (const b of this.batch) {
      const key = b.api + ':' + JSON.stringify(b.query)
      ;(callbacks[key] = callbacks[key] || []).push(b.callback)
      const g = grouped[key] = grouped[key] || { api: b.api, query: b.query, ids: new Set, callbacks: {} }
      ;(g.callbacks[b.id] = g.callbacks[b.id] || []).push(b.callback)
      g.ids.add(b.id)
    }
    this.batch = []
    const requests = []
    const requestBases = []
    for (const el of Object.values(grouped)) {
      requests.push({ api: el.api, query: el.query, params: [...el.ids]})
      requestBases.push(el)
    }
    fetchSyncAPI(requests).then(data => {
      for (let i = 0; i < data.length; i++) {
        const b = requestBases[i]
        for (const d of data[i]) {
          for (const c of b.callbacks[d.id]) c(d)
        }
      }
      this.processing = false
    })
  }
}

class ArSyncContainerBase {
  constructor() {
    this.listeners = []
  }
  release() {
    this.unsubscribeAll()
    this.eachChild(child => child.release())
    this.data = null
  }
  subscribe(key, listener) {
    this.listeners.push(ArSyncSubscriber.subscribe(key, listener))
  }
  unsubscribeAll() {
    for (const l of this.listeners) l.release()
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
  static _load({ api, id, params, query }) {
    const parsedQuery = ArSyncModel.parseQuery(query)
    if (id) {
      return SyncBatchLoader.fetch(api, id, query).then(data => new ArSyncModel(parsedQuery, data))
    } else {
      const requests = [{ api, query, params }]
      return fetchSyncAPI(requests).then(data => new ArSyncModel(parsedQuery, data[0]))
    }
  }
  static load(apiParams) {
    if (!(apiParams instanceof Array)) return this._load(apiParams)
    return new Promise((resolve, _reject) => {
      const resultModels = []
      let countdown = apiParams.length
      apiParams.forEach((param, i) => {
        this._load(param).then(model => {
          resultModels[i] = model
          countdown --
          if (countdown == 0) resolve(resultModels)
        })
      })
    })
  }
}

class ArSyncModel extends ArSyncContainerBase {
  constructor(query, data){
    super()
    this.query = query
    this.data = {}
    this.children = {}
    this.paths = []
    this.sync_keys = data.sync_keys
    if (!this.sync_keys) {
      this.sync_keys = []
      console.error('warning: no sync_keys')
    }
    this.data.id = data.id
    for (const key in query.attributes) {
      const subQuery = query.attributes[key]
      const aliasName = subQuery.as || key
      const subData = data[aliasName]
      if (key == 'sync_keys') continue
      if (subQuery.attributes && subQuery.attributes.sync_keys) {
        if (subData instanceof Array) {
          const collection = new ArSyncCollection(this.sync_keys, key, subQuery, subData)
          this.children[aliasName] = collection
          this.data[aliasName] = collection.data
        } else {
          this.paths.push(key)
          if (subData) {
            const model = new ArSyncModel(subQuery, subData)
            this.children[aliasName] = model
            this.data[aliasName] = model.data
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
  onnotify(notifyData, path) {
    const { action, class_name, id } = notifyData
    if (action == 'remove') {
      this.children[path].release()
      this.children[path] = null
      this.data[path] = null
    } else if (action == 'add') {
      const query = this.query.attributes[path]
      SyncBatchLoader.fetch(class_name, id, query).then((data) => {
        const model = new ArSyncModel(query, data)
        if (this.children[path]) this.children[path].release()
        this.children[path] = model
        this.data[path] = model.data
      })
    } else {
      SyncBatchLoader.fetch(class_name, id, this.reloadQuery()).then((data) => {
        this.update(data)
      })
    }
  }
  subscribeAll() {
    const callback = data => this.onnotify(data)
    for (const key of this.sync_keys) this.subscribe(key, callback)
    for (const path of this.paths) {
      const pathCallback = data => this.onnotify(data, path)
      for (const key of this.sync_keys) this.subscribe(key + path, pathCallback)
    }
  }
  reloadQuery() {
    if (this.reloadQueryCache) return this.reloadQueryCache
    const reloadQuery = this.reloadQueryCache = { attributes: [] }
    for (const key in this.query.attributes) {
      if (key == 'sync_keys') continue
      const val = this.query.attributes[key]
      if (!val || !val.attributes || !val.attributes.sync_keys) reloadQuery.attributes.push(key)
    }
    return reloadQuery
  }
  update(data) {
    for (const key in data) {
      this.data[key] = data[key]
    }
  }
}
class ArSyncCollection extends ArSyncContainerBase {
  constructor(sync_keys, path, query, data){
    super()
    if (sync_keys) {
      this.sync_keys = sync_keys.map(key => key + path)
    } else {
      console.error('warning: no sync_keys')
      this.sync_keys = []
    }
    this.query = query
    this.data = []
    this.children = []
    for (const subData of data) {
      const model = new ArSyncModel(this.query, subData)
      this.children.push(model)
      this.data.push(model.data)
    }
    this.subscribeAll()
  }
  onnotify(notifyData) {
    const { action, class_name, id } = notifyData
    if (action == 'add') {
      const query = this.query
      SyncBatchLoader.fetch(class_name, id, query).then((data) => {
        const model = new ArSyncModel(query, data)
        this.children.push(model)
        this.data.push(model.data)
      })
    } else if (action == 'remove') {
      const idx = this.data.findIndex(a => a.id == id)
      if (idx >= 0) {
        this.children[idx].release()
        this.children.splice(idx, 1)
        this.data.splice(idx, 1)
      }
    }
  }
  eachChild(callback) {
    for (const child of this.children) callback(child)
  }
  subscribeAll() {
    const callback = data => this.onnotify(data)
    for (const key of this.sync_keys) this.subscribe(key, callback)
  }
}


try {
  module.exports = { ArSyncModel, ArSyncCollection }
} catch (e) {
  window.ArSyncModel = ArSyncModel
  window.ArSyncCollection = ArSyncCollection
}
})()
