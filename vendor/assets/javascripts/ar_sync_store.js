(function(){

class NormalUpdator { // overwrites object. ex: Vue.js
  constructor() {
    this.changed = []
  }
  replaceData(data, newData) {
    for (const key in newData) {
      data[key] = newData[key]
    }
    return data
  }
  add(tree, path, column, value, orderParam) {
    this.changed.push([path, column, true])
    let data = tree
    path.forEach(key => { data = data[key] })
    if (data.constructor === Array && !data[column]) {
      const limitReached = orderParam && orderParam.limit && data.length === orderParam.limit
      if (orderParam && orderParam.order == 'desc') {
        data.unshift(value)
        if (limitReached) data.pop()
      } else {
        data.push(value)
        if (limitReached) data.shift()
      }
    } else {
      data[column] = value
    }
    return tree
  }
  remove(tree, path, column) {
    this.changed.push([path, column, false])
    let data = tree
    path.forEach(p => { data = data[p] })
    if (data.constructor === Array) {
      data.splice(column, 1)
    } else {
      data[column] = null
    }
    return tree
  }
}
class ImmutableUpdator { // don't overwrite object. ex: React PureComponent
  constructor() {
    this.changed = []
    this.markedObjects = []
  }
  replaceData(data, newData) {
    return newData
  }
  mark(obj) {
    if (obj.__mark__) return obj
    let marked
    if (obj.constructor === Array) {
      marked = [].concat(obj)
      marked.__mark__ = true
    } else {
      marked = Object.assign({ __mark__: true }, obj)
    }
    this.markedObjects.push(marked)
    return marked
  }
  trace(data, path) {
    path.forEach(key => {
      data[key] = this.mark(data[key])
      data = data[key]
    })
    return data
  }
  assign(el, column, value, orderParam) {
    if (el.constructor === Array && !el[column]) {
      const limitReached = orderParam && orderParam.limit && el.length === orderParam.limit
      if (orderParam && orderParam.order == 'desc') {
        el.unshift(value)
        if (limitReached) el.pop()
      } else {
        el.push(value)
        if (limitReached) el.shift()
      }
    } else {
      el[column] = value
    }
  }
  add(tree, path, column, value, orderParam) {
    this.changed.push([path, column, true])
    const root = this.mark(tree)
    const el = this.trace(root, path)
    this.assign(el, column, value, orderParam)
    return root
  }
  remove(tree, path, column) {
    this.changed.push([path, column, false])
    const root = this.mark(tree)
    let data = this.trace(root, path)
    if (data.constructor === Array) {
      data.splice(column, 1)
    } else {
      data[column] = null
    }
    return root
  }
  cleanup() {
    this.markedObjects.forEach(marked => {
      delete marked.__mark__
    })
  }
}

const SyncBatchLoader = {
  fetch(api, id, query) {
    let callback
    return new Promise((resolve, _reject) => {
      this.batch.push({ api, id, query, resolve })
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
      const key = b.api + '/' + JSON.stringify(b.query)
      (callbacks[key] = callbacks[key] || []).push(b.callback)
      const g = grouped[key] = grouped[key] || { api: b.api, query: b.query, ids: new Set, callbacks: {} }
      (g.callbacks[b.id] = g.callbacks[b.id] || []).push(b.callback)
      g.ids.push(b.id)
    }
    const requests = []
    const requestBases = []
    for (const el of grouped) {
      requests.push([el.api, { query: el.query, params: { ids: [...el.ids] }]})
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

ArSyncModel.loadFromApi = function(api, params, query) {
  const request = {}
  request[api] = { query, params }
  return fetchSyncAPI(request).then(data => new ArSyncModel(data, query))
}
ArSyncModel.load = function(api, idOrParams, query) {
  if (typeof idOrParams == 'object') {
    const request = {}
    request[api] = { query, params: idOrParams }
    return fetchSyncAPI(request).then(data => new ArSyncModel(data, query))
  } else {
    const id = idOrParams
    return SyncBatchLoader.fetch(api, id, query).then(data => new ArSyncModel(data, query))
  }
}
class ArSyncModel {
  constructor(query, data) {
    this.query = query
    this.data = {}
    this.paths = []
    for (const key in data) {
      const subData = data[key]
      if (key == 'sync_keys') continue
      if (subData && subData.sync_keys) {
        this.paths.push(key)
        this.data[key] = new ArSyncModel(subData, query[key])
      } else if(subData instanceof Array) {
        this.paths.push(key)
        this.data[key] = subData.map(el => {
          return (el && el.sync_keys) ? new ArSyncModel(el, query[key]) : el
        })
      } else {
        this.data[key] = subData
      }
    }
    this.subscribe()
  }
  onnotify(notifyData) {
    const { action, path, class_name, id } = notifyData
    if (action == 'remove') {
      if (this.data[path] instanceof Array) {
        const array = this.data[path]
        const idx = array.findIndex(a => a.id == id)
        if (idx >= 0) array.splice(idx, 1)
      } else {
        this.data[path] = null
      }
    }
    if (path) {
      const query = this.query[path]
      SyncBatchLoader.fetch(class_name, id, query, (data) => {
        if (this.data[path] instanceof Array) {
          this.data[path].push(new ArSyncModel(data, query))
        } else {
          this.data[path] = new ArSyncModel(data, query)
        }
      })
    } else {
      SyncBatchLoader.fetch(class_name, id, query, (data) => {
        this.update(data)
      })
    }
  }
  subscribe() {
    this.listeners = []
    const callback = data => this.onnotify(data)
    for (const key of this.sync_keys) {
      this.listeners.push(ArSyncSubscriber.subscribe(key, callback))
      for (const path of this.paths) {
        this.listeners.push(ArSyncSubscriber.subscribe(key + '/' + path, callback))
      }
    }
  }
  unsubscribe() {
    for (const l of this.listeners) l.release()
    this.listeners = []
  }
}

try {
  module.exports = ArSyncModel
} catch (e) {
  window.ArSyncModel = ArSyncModel
}
})()
