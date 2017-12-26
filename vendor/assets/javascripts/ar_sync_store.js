class NormalUpdator { // overwrites object. ex: Vue.js
  constructor() {
    this.changed = []
  }
  add(tree, path, column, value) {
    this.changed.push([path, column, true])
    let data = tree
    path.forEach(key => { data = data[key] })
    if (data.constructor === Array && data.length === column) {
      data.push(value)
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
  add(tree, path, column, value) {
    this.changed.push([path, column, true])
    const root = this.mark(tree)
    this.trace(root, path)[column] = value
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
    this.order = option.order
    this.limit = option.limit
    this.query = ARSyncStore.parseQuery(query).attributes
    this.updatorClass = option.updatorClass || (
      option.immutable ? ImmutableUpdator : NormalUpdator
    )
  }
  batchUpdate(patches) {
    const updator = this.updatorClass && new this.updatorClass()
    patches.forEach(patch => {
      this._update(patch.action, patch.path, patch.data, updator)
    })
    if (updator.cleanup) updator.cleanup()
    if (this.order) {
      this.data.sort((a, b) => {
        return a.id == b.id ? 0 : (a.id < b.id ? -1 : 1) * (this.order == 'asc' ? 1 : -1)
      })
    }
    if (this.limit) {
      while (this.data.length > this.limit) {
        this.data.pop()
      }
    }
    return updator.changed
  }
  update(patch) {
    return this.batchUpdate([patch])
  }
  _update(action, path, patch, updator) {
    let query = this.query
    let data = this.data
    function slicePatch(patch, query) {
      const obj = {}
      for (const key in patch) {
        if (key === 'id') {
          obj.id = patch.id
        } else {
          const subq = query[key]
          if (subq) {
            obj[subq.column || key] = patch[key]
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
    if (typeof(nameOrId) === 'number') {
      id = nameOrId
      const idx = data.findIndex(o => o.id === id)
    } else {
      if (!query[nameOrId]) return
      column = query[nameOrId].column || nameOrId
      query = query[nameOrId].attributes
    }
    if (action === 'create') {
      const obj = slicePatch(patch, query)
      if (column) {
        this.data = updator.add(this.data, actualPath, column, obj)
      } else if (!data.find(o => o.id === id)) {
        this.data = updator.add(this.data, actualPath, data.length, obj)
      }
    } else if (action === 'destroy') {
      if (column) {
        this.data = updator.remove(this.data, actualPath, column)
      } else {
        const idx = data.findIndex(o => o.id === id)
        if (idx >= 0) this.data = updator.remove(this.data, actualPath, idx)
      }
    } else {
      if (!column) {
        const idx = data.findIndex(o => o.id === id)
        if (idx < 0) return
        actualPath.push(idx)
      }
      for (const key in patch) {
        const subq = query[key]
        const value = patch[key]
        if (subq) {
          const subcol = subq.column || key
          if (data[subcol] !== value) {
            this.data = updator.add(this.data, actualPath, subcol, value)
          }
        }
      }
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

try { module.exports = ARSyncStore } catch (e) {}
