class Updator {
  changes
  markedForFreezeObjects
  immutable
  data
  constructor(immutable) {
    this.changes = []
    this.markedForFreezeObjects = []
    this.immutable = immutable
  }
  static createFrozenObject(obj) {
    if (!obj) return obj
    if (obj.constructor === Array) {
      obj = obj.map(el => Updator.createFrozenObject(el))
    } else if (typeof obj === 'object') {
      obj = Object.assign({}, obj)
      for (const key in obj) {
        obj[key] = Updator.createFrozenObject(obj[key])
      }
    }
    Object.freeze(obj)
    return obj
  }
  replaceData(data, newData) {
    if (this.immutable) return Updator.createFrozenObject(newData)
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
    if (!Object.isFrozen(this.data)) return obj
    const mobj = (obj.constructor === Array) ? [...obj] : { ...obj }
    this.markedForFreezeObjects.push(mobj)
    return mobj
  }
  trace(data, path) {
    path.forEach(key => {
      if (this.immutable) data[key] = this.mark(data[key])
      data = data[key]
    })
    return data
  }
  assign(el, path, column, value, orderParam) {
    if (this.immutable) value = Updator.createFrozenObject(value)
    if (el.constructor === Array && !el[column]) {
      this.changes.push({
        path: path.concat([value.id]),
        target: el,
        id: value.id,
        valueWas: null,
        value
      })
      const limitReached = orderParam && orderParam.limit != null && el.length === orderParam.limit
      let removed
      if (orderParam && orderParam.order == 'desc') {
        el.unshift(value)
        if (limitReached) removed = el.pop()
      } else {
        el.push(value)
        if (limitReached) removed = el.pop()
      }
      if (removed) this.changes.push({
        path: path.concat([removed.id]),
        target: el,
        id: removed.id,
        valueWas: removed,
        value: null
      })
    } else if (!this.valueEquals(el[column], value)) {
      this.changes.push({
        path: path.concat([column]),
        target: el,
        column: column,
        valueWas: el[column],
        value
      })
      el[column] = value
    }
  }
  valueEquals(a, b) {
    if (a === b) return true
    if (!a || !b) return a == b
    if (typeof a !== 'object') return false
    if (typeof b !== 'object') return false
    const ja = JSON.stringify(a)
    const jb = JSON.stringify(b)
    return ja === jb
  }
  add(tree, accessKeys, path, column, value, orderParam) {
    const root = this.mark(tree)
    const data = this.trace(root, accessKeys)
    if (data) this.assign(data, path, column, value, orderParam)
    return root
  }
  remove(tree, accessKeys, path, column) {
    const root = this.mark(tree)
    let data = this.trace(root, accessKeys)
    if (!data) return root
    if (data.constructor === Array) {
      this.changes.push({
        path: path.concat([data[column].id]),
        target: data,
        id: data[column].id,
        valueWas: data[column],
        value: null
      })
      data.splice(column, 1)
    } else if (data[column] !== null) {
      this.changes.push({
        path: path.concat([column]),
        target: data,
        column: column,
        valueWas: data[column],
        value: null
      })
      data[column] = null
    }
    return root
  }
  cleanup() {
    this.markedForFreezeObjects.forEach(mobj => Object.freeze(mobj))
  }
}

export default class ArSyncStore {
  data
  request
  immutable
  constructor(request, data, option = {} as { immutable?: boolean }) {
    this.data = option.immutable ? Updator.createFrozenObject(data) : data
    this.request = ArSyncStore.parseQuery(request)
    this.immutable = option.immutable
  }
  replaceData(data) {
    this.data = new Updator(this.immutable).replaceData(this.data, data)
  }
  batchUpdate(patches) {
    const events = []
    const updator = new Updator(this.immutable)
    patches.forEach(patch => this._update(patch, updator, events))
    updator.cleanup()
    return { changes: updator.changes, events }
  }
  update(patch) {
    return this.batchUpdate([patch])
  }
  _slicePatch(patchData, request) {
    const obj = {}
    for (const key in patchData) {
      if (key === 'id' || request.query['*']) {
        obj[key] = patchData[key]
      } else {
        const subq = request.query[key]
        if (subq) {
          obj[subq.column || key] = patchData[key]
        }
      }
    }
    return obj
  }
  _applyPatch(data, accessKeys, actualPath, updator, request, patchData) {
    for (const key in patchData) {
      const subq = request.query[key]
      const value = patchData[key]
      if (subq || request.query['*']) {
        const subcol = (subq && subq.column) || key
        if (data[subcol] !== value) {
          this.data = updator.add(this.data, accessKeys, actualPath, subcol, value)
        }
      }
    }
  }
  _update(patch, updator, events) {
    const { action, path } = patch
    const patchData = patch.data
    let request = this.request
    let data = this.data
    const actualPath: (string | number)[] = []
    const accessKeys: (string | number)[] = []
    for (let i = 0; i < path.length - 1; i++) {
      const nameOrId = path[i]
      if (typeof(nameOrId) === 'number') {
        const idx = data.findIndex(o => o.id === nameOrId)
        if (idx < 0) return
        actualPath.push(nameOrId)
        accessKeys.push(idx)
        data = data[idx]
      } else {
        const { query } = request
        if (!query[nameOrId]) return
        const column = query[nameOrId].column || nameOrId
        request = query[nameOrId]
        actualPath.push(column)
        accessKeys.push(column)
        data = data[column]
      }
      if (!data) return
    }
    const nameOrId = path[path.length - 1]
    let id, idx, column, target = data
    if (typeof(nameOrId) === 'number') {
      id = nameOrId
      idx = data.findIndex(o => o.id === id)
      target = data[idx]
    } else if (nameOrId) {
      const { query } = request
      if (!query[nameOrId]) return
      column = query[nameOrId].column || nameOrId
      request = query[nameOrId]
      target = data[column]
    }
    if (action === 'create') {
      const obj = this._slicePatch(patchData, request)
      if (column) {
        this.data = updator.add(this.data, accessKeys, actualPath, column, obj)
      } else if (!target) {
        const ordering = Object.assign({}, patch.ordering)
        const limitOverride = request.params && request.params.limit
        ordering.order = request.params && request.params.order || ordering.order
        if (ordering.limit == null || limitOverride != null && limitOverride < ordering.limit) ordering.limit = limitOverride
        this.data = updator.add(this.data, accessKeys, actualPath, data.length, obj, ordering)
      }
      return
    }
    if (action === 'destroy') {
      if (column) {
        this.data = updator.remove(this.data, accessKeys, actualPath, column)
      } else if (idx >= 0) {
        this.data = updator.remove(this.data, accessKeys, actualPath, idx)
      }
      return
    }
    if (!target) return
    if (column) {
      actualPath.push(column)
      accessKeys.push(column)
    } else if (id) {
      actualPath.push(id)
      accessKeys.push(idx)
    }
    if (action === 'update') {
      this._applyPatch(target, accessKeys, actualPath, updator, request, patchData)
    } else {
      const eventData = { target, path: actualPath, data: patchData.data }
      events.push({ type: patchData.type, data: eventData })
    }
  }

  static parseQuery(request, attrsonly?){
    const query = {}
    let column = null
    let params = null
    if (request.constructor !== Array) request = [request]
    for (const arg of request) {
      if (typeof(arg) === 'string') {
        query[arg] = {}
      } else if (typeof(arg) === 'object') {
        for (const key in arg){
          const value = arg[key]
          if (attrsonly) {
            query[key] = this.parseQuery(value)
            continue
          }
          if (key === 'query') {
            const child = this.parseQuery(value, true)
            for (const k in child) query[k] = child[k]
          } else if (key === 'as') {
            column = value
          } else if (key === 'params') {
            params = value
          } else {
            query[key] = this.parseQuery(value)
          }
        }
      }
    }
    if (attrsonly) return query
    return { query, column, params }
  }
}
