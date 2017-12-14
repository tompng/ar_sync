class ARSyncStore {
  constructor(keys, query, data) {
    this.data = data
    this.query = ARSyncStore.parseQuery(query)
  }
  update(action, path, patch) {
    let query = this.query
    let data = this.data
    for(const i in path) {
      const name = path[i][0]
      const id = path[i][1]
      if (!query[name]) return
      query = query[name]
      if (!path[i + 1]) {
        if (action === 'create') {
          const obj = {}
          for (const key in patch) {
            if (query[key]) obj[key] = patch[key]
          }
          if (id) {
            const array = data[name]
            if (array && !array.find(o => o.id == id)) data[name].push(obj)
          } else {
            data[name] = obj
          }
          return
        } else if (action === 'destroy') {
          if (id) {
            if (data[name]) data[name] = data[name].filter(o => o.id != id)
          } else {
            data[name] = null
          }
        }
      }
      data = data[name]
      if (!data) return
      if (id) {
        const item = data.find(o => o.id == id)
        data = item
      }
      if (!data) return
    }
    for (const key in patch) {
      if (query[key]) data[key] = patch[key]
    }
  }

  static parseQuery(query, attrsonly){
    const attributes = {}
    for (const arg of query) {
      if (typeof(arg) === 'string') {
        attributes[arg] = {}
      } else if (typeof(arg) == 'object') {
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
            throw 'not implemented'
          } else {
            attributes[key] = this.parseQuery(value)
          }
        }
      }
    }
    return attributes
  }
}
module.exports = ARSyncStore
