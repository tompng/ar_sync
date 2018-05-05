(function(){

class NormalUpdator { // overwrites object. ex: Vue.js
  constructor() {
    this.changed = []
  }
  replaceData(data, newData) {
    const replaceArray = (as, bs) => {
      const aids = {}
      for (const a of as) {
        if (!a.id) return false
        aids[a.id] = a
      }
      const order = {}
      for (let i = 0; i < bs.length; i++) {
        const b = bs[i]
        if (!b.id) return false
        if (aids[b.id]) {
          replaceObject(aids[b.id], b)
        } else {
          as.push(b)
        }
        order[b.id] = i + 1
      }
      as.sort((a, b) => {
        const oa = order[a.id] || Infinity
        const ob = order[b.id] || Infinity
        return oa > ob ? +1 : oa < ob ? -1 : 0
      })
      while (as.length && !order[as[as.length - 1].id]) as.pop()
      return true
    }
    const replaceObject = (aobj, bobj) => {
      const keys = {}
      for (const key in aobj) keys[key] = true
      for (const key in bobj) keys[key] = true
      for (const key in keys) {
        const a = aobj[key]
        const b = bobj[key]
        if ((a instanceof Array) && (b instanceof Array)) {
          if (!replaceArray(a, b)) aobj[key] = b
        } else if(a && b && (typeof a === 'object') && (typeof b === 'object') && !(a instanceof Array) && !(b instanceof Array)) {
          replaceObject(a, b)
        } else if (a !== b) {
          aobj[key] = b
        }
      }
    }
    replaceObject(data, newData)
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

class ArSyncStore {
  constructor(query, data, option = {}) {
    this.data = data
    this.query = ArSyncStore.parseQuery(query)
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
          const subq = query.attributes[key]
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
        const { attributes } = query
        if (!attributes[nameOrId]) return
        const column = attributes[nameOrId].column || nameOrId
        query = attributes[nameOrId]
        actualPath.push(column)
        data = data[column]
      }
      if (!data) return
    }
    const nameOrId = path[path.length - 1]
    let id, column
    const applyPatch = (data, query, patchData) => {
      for (const key in patchData) {
        const subq = query.attributes[key]
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
      const { attributes } = query
      if (!attributes[nameOrId]) return
      column = attributes[nameOrId].column || nameOrId
      query = attributes[nameOrId]
    } else {
      applyPatch(data, query, patchData)
      return
    }
    if (action === 'create') {
      const obj = slicePatch(patchData, query)
      if (column) {
        this.data = updator.add(this.data, actualPath, column, obj)
      } else if (!data.find(o => o.id === id)) {
        const ordering = Object.assign({}, patch.ordering)
        const limitOverride = query.params && query.params.limit
        if (!ordering.order) ordering.order = query.params && query.params.order
        if (!ordering.limit || limitOverride && limitOverride < ordering.limit) ordering.limit = limitOverride
        this.data = updator.add(this.data, actualPath, data.length, obj, ordering)
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
    let params = null
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
    return { attributes, column, params }
  }
}

try {
  module.exports = ArSyncStore
} catch (e) {
  window.ArSyncStore = ArSyncStore
}
})()
