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

class ArSyncModel {
  constructor(query, data) {
    if (data.collection) query = { attributes: { collection: query } }
    this.query = query
    this.data = {}
    this.children = {}
    this.paths = []
    this.sync_keys = data.sync_keys
    for (const key in data) {
      const subData = data[key]
      const subQuery = query.attributes[key]
      if (key == 'sync_keys') continue
      if (subQuery && subQuery.attributes && subQuery.attributes.sync_keys) {
        this.paths.push(key)
        if (subData instanceof Array) {
          const models = subData.map(el => new ArSyncModel(subQuery, el))
          this.children[key] = models
          this.data[key] = models.map(m => m.data)
        } else if(subData) {
          const model = new ArSyncModel(subQuery, subData)
          this.children[key] = model
          this.data[key] = model.data
        }
      } else {
        this.data[key] = subData
      }
    }
    this.collection = this.data.collection
    this.subscribe()
  }
  onnotify(path, notifyData) {
    const { action, class_name, id } = notifyData
    if (action == 'remove') {
      if (this.children[path] instanceof Array) {
        const idx = this.data[path].findIndex(a => a.id == id)
        if (idx >= 0) {
          this.children[path][idx].release()
          this.children[path].splice(idx, 1)
          this.data[path].splice(idx, 1)
        }
      } else {
        this.children[path].release()
        this.children[path] = null
        this.data[path] = null
      }
    } else if (action == 'add') {
      const query = this.query.attributes[path]
      SyncBatchLoader.fetch(class_name, id, query).then((data) => {
        const model = new ArSyncModel(query, data)
        if (this.children[path] instanceof Array) {
          this.children[path].push(model)
          this.data[path].push(model.data)
        } else {
          this.children[path] = model
          this.data[path] = model.data
        }
      })
    } else {
      SyncBatchLoader.fetch(class_name, id, this.reloadQuery()).then((data) => {
        this.update(data)
      })
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
  release() {
    this.unsubscribe()
    const releaseElements = (elements) => {
      for (const el of elements) {
        if (el.constructor == ArSyncModel) {
          el.release()
        } else if (el.constructor == Array) {
          releaseElements(el)
        }
      }
    }
    releaseElements(Object.values(this.data))
    this.data = null
  }
  subscribe() {
    this.listeners = []
    const callback = data => this.onnotify(data)
    if (!this.sync_keys) {
      console.error('warning: no sync_keys')
      return
    }
    for (const key of this.sync_keys) {
      this.listeners.push(ArSyncSubscriber.subscribe(key, data => this.onnotify('', data)))
      for (const path of this.paths) {
        this.listeners.push(ArSyncSubscriber.subscribe(key + path, data => this.onnotify(path, data)))
      }
    }
  }
  unsubscribe() {
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

try {
  module.exports = ArSyncModel
} catch (e) {
  window.ArSyncModel = ArSyncModel
}
})()
