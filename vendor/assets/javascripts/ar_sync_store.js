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

class ARSyncStore {
  constructor(query, data, option = {}) {
    this.data = data
    this.query = ARSyncStore.parseQuery(query).attributes
    this.updatorClass = option.updatorClass || (
      option.immutable ? ImmutableUpdator : NormalUpdator
    )
  }
  replaceData(data) {
    this.data = new this.updatorClass().replaceData(this.data, data)
  }
  batchUpdate(patches) {
    const updator = this.updatorClass && new this.updatorClass()
    patches.forEach(patch => this._update(patch, updator))
    if (updator.cleanup) updator.cleanup()
    return updator.changed
  }
  update(patch) {
    return this.batchUpdate([patch])
  }
  _update(patch, updator) {
    const { action, path } = patch
    const patchData = patch.data
    let query = this.query
    let data = this.data
    function slicePatch(patchData, query) {
      const obj = {}
      for (const key in patchData) {
        if (key === 'id') {
          obj.id = patchData.id
        } else {
          const subq = query[key]
          if (subq) {
            obj[subq.column || key] = patchData[key]
          }
        }
      }
      return obj
    }
    const actualPath = []
    for(let i=0; i<path.length - 1; i++) {
      const nameOrId = path[i]
      if (typeof(nameOrId) === 'number') {
        const idx = data.findIndex(o => o.id === nameOrId)
        if (idx < 0) return
        actualPath.push(idx)
        data = data[idx]
      } else {
        if (!query[nameOrId]) return
        const column = query[nameOrId].column || nameOrId
        query = query[nameOrId].attributes
        actualPath.push(column)
        data = data[column]
      }
      if (!data) return
    }
    const nameOrId = path[path.length - 1]
    let id, column
    const applyPatch = (data, query, patchData) => {
      for (const key in patchData) {
        const subq = query[key]
        const value = patchData[key]
        if (subq) {
          const subcol = subq.column || key
          if (data[subcol] !== value) {
            this.data = updator.add(this.data, actualPath, subcol, value)
          }
        }
      }
    }
    if (typeof(nameOrId) === 'number') {
      id = nameOrId
      const idx = data.findIndex(o => o.id === id)
    } else if (nameOrId) {
      if (!query[nameOrId]) return
      column = query[nameOrId].column || nameOrId
      query = query[nameOrId].attributes
    } else {
      applyPatch(data, query, patchData)
      return
    }
    if (action === 'create') {
      const obj = slicePatch(patchData, query)
      if (column) {
        this.data = updator.add(this.data, actualPath, column, obj)
      } else if (!data.find(o => o.id === id)) {
        this.data = updator.add(this.data, actualPath, data.length, obj, patch.ordering)
      }
    } else if (action === 'destroy') {
      if (column) {
        this.data = updator.remove(this.data, actualPath, column)
      } else {
        const idx = data.findIndex(o => o.id === id)
        if (idx >= 0) this.data = updator.remove(this.data, actualPath, idx)
      }
    } else {
      if (column) {
        actualPath.push(column)
      } else {
        const idx = data.findIndex(o => o.id === id)
        if (idx < 0) return
        actualPath.push(idx)
      }
      applyPatch(data, query, patchData)
    }
  }

  static parseQuery(query, attrsonly){
    const attributes = {}
    let column = null
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
          } else {
            attributes[key] = this.parseQuery(value)
          }
        }
      }
    }
    if (attrsonly) return attributes
    return { attributes, column }
  }
}

try {
  module.exports = ARSyncStore
} catch (e) {
  window.ARSyncStore = ARSyncStore
}
})()
