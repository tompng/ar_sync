class ARSyncStore {
  constructor(keys, query, data) {
    this.data = data
    this.query = ARSyncStore.parseQuery(query).attributes
  }
  update(action, path, patch) {
    let query = this.query
    let data = this.data
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
            const subq = query[key]
            if (subq) {
              obj[subq.column || key] = patch[key]
            }
          }
          if (id) {
            const array = data[column]
            if (array && !array.find(o => o.id === id)) {
              data[column].push(obj)
            }
          } else {
            data[column] = obj
          }
          return
        } else if (action === 'destroy') {
          if (id) {
            if (data[column]) data[column] = data[column].filter(o => o.id != id)
          } else {
            data[column] = null
          }
          return
        }
      }
      data = data[column]
      if (!data) return
      if (id) {
        const item = data.find(o => o.id == id)
        data = item
      }
      if (!data) return
    }
    for (const key in patch) {
      const subq = query[key]
      if (subq) data[subq.column || key] = patch[key]
    }
  }

  static parseQuery(query, attrsonly){
    const attributes = {}
    let column = null
    if (query.constructor !== Array) query = [query]
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
