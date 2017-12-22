class NormalUpdator { // overwrites object. ex: Vue.js
  constructor() {
    this.changed = []
  }
  add(tree, path, column, value) {
    this.changed.push([path, column, true])
    let data = tree
    path.forEach(key => { data = data[key] })
    data[column] = value
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
    return updator.changed
  }
  update(patch) {
    return this.batchUpdate([patch])
  }
  _update(action, path, patch, updator) {
    let query = this.query
    let data = this.data
    const actualPath = []
    for(let i=0; i<path.length; i++) {
      const name = path[i][0]
      const id = path[i][1]
      if (!query[name]) return
      const column = query[name].column || name
      query = query[name].attributes
      if (!path[i + 1]) {
        if (action === 'create') {
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
          if (id) {
            const array = data[column]
            if (array && !array.find(o => o.id === id)) {
              actualPath.push(column)
              this.data = updator.add(this.data, actualPath, array.length, obj)
            }
          } else {
            this.data = updator.add(this.data, actualPath, column, obj)
          }
          return
        } else if (action === 'destroy') {
          if (id) {
            const array = data[column]
            const idx = array.findIndex(o => o.id === id)
            if (idx >= 0) {
              actualPath.push(column)
              this.data = updator.remove(this.data, actualPath, idx)
            }
          } else {
            this.data = updator.remove(this.data, actualPath, column)
          }
          return
        }
      }
      actualPath.push(column)
      data = data[column]
      if (!data) return
      if (id) {
        const idx = data.findIndex(o => o.id === id)
        actualPath.push(idx)
        data = data[idx]
      }
      if (!data) return
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
module.exports = ARSyncStore
