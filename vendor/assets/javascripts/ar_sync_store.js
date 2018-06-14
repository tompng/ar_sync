(function(){
let ArSyncSubscriber, fetchSyncAPI
try {
  ArSyncSubscriber = require('./ar_sync_data')
  fetchSyncAPI = require('./ar_sync_fetch')
} catch(e) {
  ArSyncSubscriber = window.ArSyncSubscriber
  fetchSyncAPI = window.fetchSyncAPI
}

class ArSyncContainerBase {
  constructor() {
    this.listeners = []
  }
  initForReload(request) {
    this.networkSubscriber = ArSyncSubscriber.connectionAdapter.subscribeNetwork((state) => {
      if (state) {
        fetchSyncAPI(request).then(data => {
          if (this.data) this.replaceData(data)
        })
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
      return fetchSyncAPI({ api, id, query }).then(data => new ArSyncModel(parsedQuery, data))
    } else {
      const request = { api, query, params }
      return fetchSyncAPI(request).then(response => {
        if (response.collection && response.order) {
          return new ArSyncCollection(response.sync_keys, 'collection', parsedQuery, response, request)
        } else {
          return new ArSyncModel(parsedQuery, response, request)
        }
      })
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
          if (countdown === 0) resolve(resultModels)
        })
      })
    })
  }
}

class ArSyncModel extends ArSyncContainerBase {
  constructor(query, data, requests){
    super()
    if (requests) this.initForReload(requests)
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
            const collection = new ArSyncCollection(this.sync_keys, key, subQuery, subData)
            this.children[aliasName] = collection
            this.data[aliasName] = collection.data
          }
        } else {
          this.paths.push(key)
          if (subData) {
            if (this.children[aliasName]) {
              this.children[aliasName].replaceData(subData)
            } else {
              const model = new ArSyncModel(subQuery, subData)
              this.children[aliasName] = model
              this.data[aliasName] = model.data
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
      this.data[path] = null
    } else if (action === 'add') {
      if (this.data.id === id) return
      const query = this.query.attributes[path]
      fetchSyncAPI({ api: class_name, id, query }).then((data) => {
        const model = new ArSyncModel(query, data)
        if (this.children[path]) this.children[path].release()
        this.children[path] = model
        this.data[path] = model.data
      })
    } else {
      fetchSyncAPI({ api: class_name, id, query: this.reloadQuery() }).then((data) => {
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
      this.data[key] = data[key]
    }
  }
}
class ArSyncCollection extends ArSyncContainerBase {
  constructor(sync_keys, path, query, data, request){
    super()
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
        model = new ArSyncModel(this.query, subData)
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
    fetchSyncAPI({ api: className, id, query: this.query }).then((data) => {
      const model = new ArSyncModel(this.query, data)
      const overflow = this.order.limit && this.order.limit === this.data.length
      if (this.order.mode === 'asc') {
        const last = this.data[this.data.length - 1]
        this.children.push(model)
        this.data.push(model.data)
        if (last && last.id > id) {
          this.children.sort((a, b) => a.data.id < b.data.id ? -1 : +1)
          this.data.sort((a, b) => a.id < b.id ? -1 : +1)
        }
        if (overflow) {
          this.children.shift().release()
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
          this.children.pop().release()
          this.data.pop()
        }
      }
    })
  }
  consumeRemove(id) {
    const idx = this.data.findIndex(a => a.id === id)
    if (idx >= 0) {
      this.children[idx].release()
      this.children.splice(idx, 1)
      this.data.splice(idx, 1)
    }
  }
  onNotify(notifyData) {
    if (notifyData.action === 'add') {
      this.consumeAdd(notifyData.class_name, notifyData.id)
    } else if (notifyData.action === 'remove') {
      this.consumeRemove(notifyData.id)
    }
  }
  eachChild(callback) {
    for (const child of this.children) callback(child)
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
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
