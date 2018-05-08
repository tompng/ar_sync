(function(){

class Updator {
  constructor(immutable) {
    this.changes = []
    this.markedObjects = []
    this.immutable = immutable
  }
  replaceData(data, newData) {
    if (this.immutable) return newData
    return this.recursivelyReplaceData(data, newData)
  }
  recursivelyReplaceData(data, newData) {
    const replaceArray = (as, bs) => {
      const aids = {}
      for (const a of as) {
        if (!a.id) return false
        aids[a.id] = a
      }
      const order = {}
      bs.forEach((b, i) => {
        if (!b.id) return false
        if (aids[b.id]) {
          replaceObject(aids[b.id], b)
        } else {
          as.push(b)
        }
        order[b.id] = i + 1
      })
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
  mark(obj) {
    if (!this.immutable) return obj
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
      if (this.immutable) data[key] = this.mark(data[key])
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
  add(tree, accessKeys, path, column, value, orderParam) {
    this.changes.push({ path, value })
    const root = this.mark(tree)
    const el = this.trace(root, accessKeys)
    this.assign(el, column, value, orderParam)
    return root
  }
  remove(tree, accessKeys, path, column) {
    this.changes.push({ path, value: null })
    const root = this.mark(tree)
    let data = this.trace(root, accessKeys)
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
    this.immutable = option.immutable
  }
  replaceData(data) {
    this.data = new Updator(this.immutable).replaceData(this.data, data)
  }
  batchUpdate(patches) {
    const updator = new Updator(this.immutable)
    patches.forEach(patch => this._update(patch, updator))
    updator.cleanup()
    return updator.changes
  }
  update(patch) {
    return this.batchUpdate([patch])
  }
  dig(data, path) {
    if (path === undefined) {
      path = data
      data = this.data
    }
    path.forEach(key => {
      if (!data) return null
      if (data instanceof Array) {
        data = data.find(el => el.id === key)
      } else {
        data = data[key]
      }
    })
    return data
  }
  _slicePatch(patchData, query) {
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
  _applyPatch(data, accessKeys, actualPath, updator, query, patchData) {
    for (const key in patchData) {
      const subq = query.attributes[key]
      const value = patchData[key]
      if (subq) {
        const subcol = subq.column || key
        if (data[subcol] !== value) {
          this.data = updator.add(this.data, accessKeys, actualPath.concat([subcol]), subcol, value)
        }
      }
    }
  }
  _update(patch, updator) {
    const { action, path } = patch
    const patchData = patch.data
    let query = this.query
    let data = this.data
    const actualPath = []
    const accessKeys = []
    for(let i=0; i<path.length - 1; i++) {
      const nameOrId = path[i]
      if (typeof(nameOrId) === 'number') {
        const idx = data.findIndex(o => o.id === nameOrId)
        if (idx < 0) return
        actualPath.push(nameOrId)
        accessKeys.push(idx)
        data = data[idx]
      } else {
        const { attributes } = query
        if (!attributes[nameOrId]) return
        const column = attributes[nameOrId].column || nameOrId
        query = attributes[nameOrId]
        actualPath.push(column)
        accessKeys.push(column)
        data = data[column]
      }
      if (!data) return
    }
    const nameOrId = path[path.length - 1]
    let id, column
    if (typeof(nameOrId) === 'number') {
      id = nameOrId
      const idx = data.findIndex(o => o.id === id)
    } else if (nameOrId) {
      const { attributes } = query
      if (!attributes[nameOrId]) return
      column = attributes[nameOrId].column || nameOrId
      query = attributes[nameOrId]
    } else {
      this._applyPatch(data, accessKeys, actualPath, updator, query, patchData)
      return
    }
    if (action === 'create') {
      const obj = this._slicePatch(patchData, query)
      if (column) {
        this.data = updator.add(this.data, accessKeys, actualPath.concat([column]), column, obj)
      } else if (!data.find(o => o.id === id)) {
        const ordering = Object.assign({}, patch.ordering)
        const limitOverride = query.params && query.params.limit
        if (!ordering.order) ordering.order = query.params && query.params.order
        if (!ordering.limit || limitOverride && limitOverride < ordering.limit) ordering.limit = limitOverride
        this.data = updator.add(this.data, accessKeys, actualPath.concat(id), data.length, obj, ordering)
      }
    } else if (action === 'destroy') {
      if (column) {
        this.data = updator.remove(this.data, accessKeys, actualPath.concat([column]), column)
      } else {
        const idx = data.findIndex(o => o.id === id)
        if (idx >= 0) this.data = updator.remove(this.data, accessKeys, actualPath.concat([id]), idx)
      }
    } else {
      if (column) {
        actualPath.push(column)
        accessKeys.push(column)
      } else {
        const idx = data.findIndex(o => o.id === id)
        if (idx < 0) return
        actualPath.push(id)
        accessKeys.push(idx)
      }
      this._applyPatch(data, accessKeys, actualPath, updator, query, patchData)
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
