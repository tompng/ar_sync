class ARSyncStore {
  constructor(keys, query, data) {
    this.data = data
    this.query = ARSyncStore.parseQuery(query).attributes
  }
  update(action, path, patch) {
    const updator = {
      add(data, path, column, obj) {
        let d = data
        path.forEach(p => {d = d[p]})
        d[column] = obj
        return data
      },
      remove(data, path, column) {
        let d = data
        path.forEach(p => {d = d[p]})
        if (d.constructor === Array) {
          d.splice(column, 1)
        } else {
          d[column] = null
        }
        return data
      }
    }
    this._update(action, path, patch, updator)
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
            const subq = query[key]
            if (subq) {
              obj[subq.column || key] = patch[key]
            }
          }
          if (id) {
            const array = data[column]
            if (array && !array.find(o => o.id === id)) {
              actualPath.push(column)
              if (updator) {
                this.data = updator.add(this.data, actualPath, array.length, obj)
              } else {
                array.push(obj)
              }
            }
          } else {
            if (updator) {
              this.data = updator.add(this.data, actualPath, column, obj)
            } else {
              data[column] = obj
            }
          }
          return
        } else if (action === 'destroy') {
          if (id) {
            const array = data[column]
            const idx = array.findIndex(o => o.id === id)
            if (idx >= 0) {
              if (updator) {
                actualPath.push(column)
                this.data = updator.remove(this.data, actualPath, idx)
              } else {
                array.splice(idx, 1)
              }
            }
          } else {
            if (updator) {
              this.data = updator.remove(this.data, actualPath, column)
            } else {
              data[column] = null
            }
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
          if (updator) {
            this.data = updator.add(this.data, actualPath, subcol, value)
          } else {
            data[subcol] = value
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
module.exports = ARSyncStore
