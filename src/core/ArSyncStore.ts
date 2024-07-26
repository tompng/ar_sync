import ArSyncApi from './ArSyncApi'
export type Request = { api: string; query: any; params?: any; id?: IDType }

type IDType = number | string

class ModelBatchRequest {
  timer: number | null = null
  apiRequests = new Map<string,
    Map<string,
      {
        query,
        requests: Map<IDType, {
          id: IDType
          model?
          callbacks: {
            resolve: (model: any) => void
            reject: (error?: any) => void
          }[]
        }>
      }
    >
  >()
  fetch(api: string, query, id: IDType) {
    this.setTimer()
    return new Promise((resolve, reject) => {
      const queryJSON = JSON.stringify(query)
      let apiRequest = this.apiRequests.get(api)
      if (!apiRequest) this.apiRequests.set(api, apiRequest = new Map())
      let queryRequests = apiRequest.get(queryJSON)
      if (!queryRequests) apiRequest.set(queryJSON, queryRequests = { query, requests: new Map() })
      let request = queryRequests.requests.get(id)
      if (!request) queryRequests.requests.set(id, request = { id, callbacks: [] })
      request.callbacks.push({ resolve, reject })
    })
  }
  batchFetch() {
    this.apiRequests.forEach((apiRequest, api) => {
      apiRequest.forEach(({ query, requests }) => {
        const ids = Array.from(requests.keys())
        ArSyncApi.syncFetch({ api, query, params: { ids } }).then((models: any[]) => {
          for (const model of models) {
            const req = requests.get(model._sync.id)
            if (req) req.model = model
          }
          requests.forEach(({ model, callbacks }) => {
            callbacks.forEach(cb => cb.resolve(model))
          })
        }).catch(e => {
          requests.forEach(({ callbacks }) => {
            callbacks.forEach(cb => cb.reject(e))
          })
        })
      })
    })
    this.apiRequests.clear()
  }
  setTimer() {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.batchFetch()
    }, 20)
  }
}
const modelBatchRequest = new ModelBatchRequest

type ParsedQuery = {
  attributes: Record<string, ParsedQuery>
  as?: string
  params: any
} | {}

type SyncField = { id: IDType; keys: string[] }
type Unsubscribable = { unsubscribe: () => void }

class ArSyncContainerBase {
  data
  listeners: Unsubscribable[] = []
  networkSubscriber?: Unsubscribable
  parentModel: ArSyncRecord | ArSyncCollection | null = null
  parentKey
  children: ArSyncContainerBase[] | { [key: string]: ArSyncContainerBase | null }
  onConnectionChange?: (status: boolean) => void
  replaceData(_data, _parentSyncKeys?) {}
  initForReload(request) {
    this.networkSubscriber = ArSyncStore.connectionManager.subscribeNetwork((state) => {
      if (!state) {
        if (this.onConnectionChange) this.onConnectionChange(false)
        return
      }
      if (request.id != null) {
        modelBatchRequest.fetch(request.api, request.query, request.id).then(data => {
          if (this.data && data) {
            this.replaceData(data)
            if (this.onConnectionChange) this.onConnectionChange(true)
            if (this.onChange) this.onChange([], this.data)
          }
        })
      } else {
        ArSyncApi.syncFetch(request).then(data => {
          if (this.data && data) {
            this.replaceData(data)
            if (this.onConnectionChange) this.onConnectionChange(true)
            if (this.onChange) this.onChange([], this.data)
          }
        }).catch(e => {
          console.error(`failed to reload. ${e}`)
        })
      }
    })
  }
  release() {
    if (this.networkSubscriber) this.networkSubscriber.unsubscribe()
    this.unsubscribeAll()
    for (const child of Object.values(this.children)) {
      if (child) child.release()
    }
    this.data = null
  }
  onChange(path, data) {
    if (this.parentModel) this.parentModel.onChange([this.parentKey, ...path], data)
  }
  subscribe(key: string, listener) {
    this.listeners.push(ArSyncStore.connectionManager.subscribe(key, listener))
  }
  unsubscribeAll() {
    for (const l of this.listeners) l.unsubscribe()
    this.listeners = []
  }
  static compactQueryAttributes(query: ParsedQuery) {
    function compactAttributes(attributes: Record<string, ParsedQuery>): [ParsedQuery, boolean] {
      const attrs = {}
      const keys: string[] = []
      for (const key in attributes) {
        const c = compactQuery(attributes[key])
        if (c === true) {
          keys.push(key)
        } else {
          attrs[key] = c
        }
      }
      if (Object.keys(attrs).length === 0) {
        if (keys.length === 0) return [true, false]
        if (keys.length === 1) return [keys[0], false]
        return [keys, false]
      }
      const needsEscape = attrs['attributes'] || attrs['params'] || attrs['as']
      if (keys.length === 0) return [attrs, needsEscape]
      return [[...keys, attrs], needsEscape]
    }
    function compactQuery(query: ParsedQuery): ParsedQuery {
      if (!('attributes' in query)) return true
      const { as, params } = query
      const [attributes, needsEscape] = compactAttributes(query.attributes)
      if (as == null && params == null){
        if (needsEscape) return { attributes }
        return attributes
      }
      const result: { as?: string; params?: any; attributes?: any } = {}
      if (as) result.as = as
      if (params) result.params = params
      if (attributes !== true) result.attributes = attributes
      return result
    }
    const result = compactQuery(query)
    if (typeof result === 'object' && 'attributes' in result) return result.attributes
    return result === true ? {} : result
  }
  static parseQuery(query, attrsonly: true): Record<string, ParsedQuery>
  static parseQuery(query): ParsedQuery
  static parseQuery(query, attrsonly?: true) {
    const attributes: Record<string, ParsedQuery> = {}
    let column = null
    let params = null
    if (!query) query = []
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
    return { attributes, as: column, params }
  }
  static load({ api, id, params, query }: Request, root: ArSyncStore) {
    const parsedQuery = ArSyncRecord.parseQuery(query)
    const compactQueryAttributes = ArSyncRecord.compactQueryAttributes(parsedQuery)
    if (id != null) {
      return modelBatchRequest.fetch(api, compactQueryAttributes, id).then(data => {
        if (!data) throw { retry: false }
        const request = { api, id, query: compactQueryAttributes }
        return new ArSyncRecord(parsedQuery, data, request, root, null, null)
      })
    } else {
      const request = { api, query: compactQueryAttributes, params }
      return ArSyncApi.syncFetch(request).then((response: any) => {
        if (!response) {
          throw { retry: false }
        } else if (response.collection && response.order && response._sync) {
          return new ArSyncCollection(response._sync.keys, 'collection', parsedQuery, response, request, root, null, null)
        } else if (response instanceof Array) {
          return new ArSyncCollection([], '', parsedQuery, response, request, root, null, null)
        } else {
          return new ArSyncRecord(parsedQuery, response, request, root, null, null)
        }
      })
    }
  }
}

type NotifyData = {
  action: 'add' | 'remove' | 'update'
  class: string
  id: IDType
  field?: string
}

class ArSyncRecord extends ArSyncContainerBase {
  id: IDType
  root: ArSyncStore
  query
  queryAttributes
  data
  syncKeys: string[]
  children: { [key: string]: ArSyncContainerBase | null }
  paths: string[]
  reloadQueryCache
  rootRecord: boolean
  fetching = new Set<string>()
  constructor(query, data, request, root: ArSyncStore, parentModel: ArSyncRecord | ArSyncCollection | null, parentKey: string | number | null) {
    super()
    this.root = root
    if (request) this.initForReload(request)
    this.query = query
    this.queryAttributes = query.attributes || {}
    this.data = {}
    this.children = {}
    this.rootRecord = !parentModel
    this.id = data._sync.id
    this.syncKeys = data._sync.keys
    this.replaceData(data)
    this.parentModel = parentModel
    this.parentKey = parentKey
  }
  replaceData(data: { _sync: SyncField }) {
    this.id = data._sync.id
    this.syncKeys = data._sync.keys
    this.unsubscribeAll()
    this.paths = []
    for (const key in this.queryAttributes) {
      const subQuery = this.queryAttributes[key]
      const aliasName = subQuery.as || key
      const subData = data[aliasName]
      const child = this.children[aliasName]
      if (key === '_sync') continue
      if (subData instanceof Array || (subData && subData.collection && subData.order && subData._sync)) {
        if (child) {
          child.replaceData(subData, this.syncKeys)
        } else {
          const collection = new ArSyncCollection(this.syncKeys, key, subQuery, subData, null, this.root, this, aliasName)
          this.mark()
          this.children[aliasName] = collection
          this.data[aliasName] = collection.data
        }
      } else {
        if (subQuery.attributes && Object.keys(subQuery.attributes).length > 0) this.paths.push(key)
        if (subData && subData._sync) {
          if (child) {
            child.replaceData(subData)
          } else {
            const model = new ArSyncRecord(subQuery, subData, null, this.root, this, aliasName)
            this.mark()
            this.children[aliasName] = model
            this.data[aliasName] = model.data
          }
        } else {
          if(child) {
            child.release()
            delete this.children[aliasName]
          }
          if (this.data[aliasName] !== subData) {
            this.mark()
            this.data[aliasName] = subData
          }
        }
      }
    }
    if (this.queryAttributes['*']) {
      for (const key in data) {
        if (key === '_sync') continue
        if (!this.queryAttributes[key] && this.data[key] !== data[key]) {
          this.mark()
          this.data[key] = data[key]
        }
      }
    }
    this.subscribeAll()
  }
  onNotify(notifyData: NotifyData, path?: string) {
    const { action, class: className, id } = notifyData
    const query = path && this.queryAttributes[path]
    const aliasName = (query && query.as) || path;
    if (action === 'remove') {
      const child = this.children[aliasName]
      this.fetching.delete(`${aliasName}:${id}`) // To cancel consumeAdd
      if (child) child.release()
      this.children[aliasName] = null
      this.mark()
      this.data[aliasName] = null
      this.onChange([aliasName], null)
    } else if (action === 'add') {
      const child = this.children[aliasName]
      if (child instanceof ArSyncRecord && child.id === id) return
      const fetchKey = `${aliasName}:${id}`
      this.fetching.add(fetchKey)
      modelBatchRequest.fetch(className, ArSyncRecord.compactQueryAttributes(query), id).then(data => {
        // Record already removed
        if (!this.fetching.has(fetchKey)) return

        this.fetching.delete(fetchKey)
        if (!data || !this.data) return
        const model = new ArSyncRecord(query, data, null, this.root, this, aliasName)
        const child = this.children[aliasName]
        if (child) child.release()
        this.children[aliasName] = model
        this.mark()
        this.data[aliasName] = model.data
        this.onChange([aliasName], model.data)
      }).catch(e => {
        console.error(`failed to load ${className}:${id} ${e}`)
      })
    } else {
      const { field } = notifyData
      const query = field ? this.patchQuery(field) : this.reloadQuery()
      if (!query) return
      modelBatchRequest.fetch(className, query, id).then(data => {
        if (this.data) this.update(data)
      }).catch(e => {
        console.error(`failed to load patch ${className}:${id} ${e}`)
      })
    }
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
    for (const key of this.syncKeys) {
      this.subscribe(key, callback)
    }
    for (const path of this.paths) {
      const pathCallback = data => this.onNotify(data, path)
      for (const key of this.syncKeys) this.subscribe(key + path, pathCallback)
    }
    if (this.rootRecord) {
      const key = this.syncKeys[0]
      if (key) this.subscribe(key + '_destroy', () => this.root.handleDestroy())
    }
  }
  patchQuery(key: string) {
    const subQuery = this.queryAttributes[key]
    if (subQuery) return { [key]: subQuery }
  }
  reloadQuery() {
    if (this.reloadQueryCache) return this.reloadQueryCache
    let arrayQuery = [] as string[] | null
    const hashQuery = {}
    for (const key in this.queryAttributes) {
      if (key === '_sync') continue
      const val = this.queryAttributes[key]
      if (!val || !val.attributes) {
        arrayQuery?.push(key)
        hashQuery[key] = true
      } else if (!val.params && Object.keys(val.attributes).length === 0) {
        arrayQuery = null
        hashQuery[key] = val
      }
    }
    return this.reloadQueryCache = arrayQuery || hashQuery
  }
  update(data) {
    for (const key in data) {
      if (key === '_sync') continue
      const subQuery = this.queryAttributes[key]
      if (subQuery && subQuery.attributes && Object.keys(subQuery.attributes).length > 0) continue
      if (this.data[key] === data[key]) continue
      this.mark()
      this.data[key] = data[key]
      this.onChange([key], data[key])
    }
  }
  markAndSet(key: string, data: any) {
    this.mark()
    this.data[key] = data
  }
  mark() {
    if (!this.root || !this.root.immutable || !Object.isFrozen(this.data)) return
    this.data = { ...this.data }
    this.root.mark(this.data)
    if (this.parentModel && this.parentKey) (this.parentModel as { markAndSet(key: string | number, data: any): any }).markAndSet(this.parentKey, this.data)
  }
}

type Ordering = { first?: number; last?: number; orderBy: string; direction: 'asc' | 'desc' }
class ArSyncCollection extends ArSyncContainerBase {
  root: ArSyncStore
  path: string
  ordering: Ordering = { orderBy: 'id', direction: 'asc' }
  query
  queryAttributes
  compactQueryAttributes
  syncKeys: string[]
  data: any[]
  children: ArSyncRecord[]
  aliasOrderKey = 'id'
  fetching = new Set<IDType>()
  constructor(parentSyncKeys: string[], path: string, query, data: any[], request, root: ArSyncStore, parentModel: ArSyncRecord | null, parentKey: string | null){
    super()
    this.root = root
    this.path = path
    this.query = query
    this.queryAttributes = query.attributes || {}
    this.compactQueryAttributes = ArSyncRecord.compactQueryAttributes(query)
    if (request) this.initForReload(request)
    if (query.params) {
      this.setOrdering(query.params)
    }
    this.data = []
    this.children = []
    this.replaceData(data, parentSyncKeys)
    this.parentModel = parentModel
    this.parentKey = parentKey
  }
  setOrdering(ordering: { first?: unknown; last?: unknown; orderBy?: unknown; direction?: unknown }) {
    let direction: 'asc' | 'desc' = 'asc'
    let orderBy: string = 'id'
    let first: number | undefined = undefined
    let last: number | undefined = undefined
    if (ordering.direction === 'desc') direction = ordering.direction
    if (typeof ordering.orderBy === 'string') orderBy = ordering.orderBy
    if (typeof ordering.first === 'number') first = ordering.first
    if (typeof ordering.last === 'number') last = ordering.last
    const subQuery = this.queryAttributes[orderBy]
    this.aliasOrderKey = (subQuery && subQuery.as) || orderBy
    this.ordering = { first, last, direction, orderBy }
  }
  setSyncKeys(parentSyncKeys: string[] | undefined) {
    if (parentSyncKeys) {
      this.syncKeys = parentSyncKeys.map(key => key + this.path)
    } else {
      this.syncKeys = []
    }
  }
  replaceData(data: any[] | { collection: any[]; ordering: Ordering }, parentSyncKeys: string[]) {
    this.setSyncKeys(parentSyncKeys)
    const existings = new Map<IDType, ArSyncRecord>()
    for (const child of this.children) existings.set(child.id, child)
    let collection: any[]
    if (Array.isArray(data)) {
      collection = data
    } else {
      collection = data.collection
      this.setOrdering(data.ordering)
    }
    const newChildren: any[] = []
    const newData: any[] = []
    for (const subData of collection) {
      let model: ArSyncRecord | undefined = undefined
      if (typeof(subData) === 'object' && subData && '_sync' in subData) model = existings.get(subData._sync.id)
      let data = subData
      if (model) {
        model.replaceData(subData)
      } else if (subData._sync) {
        model = new ArSyncRecord(this.query, subData, null, this.root, this, subData._sync.id)
      }
      if (model) {
        newChildren.push(model)
        data = model.data
      }
      newData.push(data)
    }
    while (this.children.length) {
      const child = this.children.pop()!
      if (!existings.has(child.id)) child.release()
    }
    if (this.data.length || newChildren.length) this.mark()
    while (this.data.length) this.data.pop()
    for (const child of newChildren) this.children.push(child)
    for (const el of newData) this.data.push(el)
    this.subscribeAll()
  }
  consumeAdd(className: string, id: IDType) {
    const { first, last, direction } = this.ordering
    const limit = first || last
    if (this.children.find(a => a.id === id)) return
    if (limit && limit <= this.children.length) {
      const lastItem = this.children[this.children.length - 1]
      const firstItem = this.children[0]
      if (direction === 'asc') {
        if (first) {
          if (lastItem && lastItem.id < id) return
        } else {
          if (firstItem && id < firstItem.id) return
        }
      } else {
        if (first) {
          if (lastItem && id < lastItem.id) return
        } else {
          if (firstItem && firstItem.id < id) return
        }
      }
    }
    this.fetching.add(id)
    modelBatchRequest.fetch(className, this.compactQueryAttributes, id).then((data: any) => {
      // Record already removed
      if (!this.fetching.has(id)) return

      this.fetching.delete(id)
      if (!data || !this.data) return
      const model = new ArSyncRecord(this.query, data, null, this.root, this, id)
      const overflow = limit && limit <= this.data.length
      let rmodel: ArSyncRecord | undefined
      this.mark()
      const orderKey = this.aliasOrderKey
      const firstItem = this.data[0]
      const lastItem = this.data[this.data.length - 1]
      if (direction === 'asc') {
        if (firstItem && data[orderKey] < firstItem[orderKey]) {
          this.children.unshift(model)
          this.data.unshift(model.data)
        } else {
          const skipSort = lastItem && lastItem[orderKey] < data[orderKey]
          this.children.push(model)
          this.data.push(model.data)
          if (!skipSort) this.markAndSort()
        }
      } else {
        if (firstItem && data[orderKey] > firstItem[orderKey]) {
          this.children.unshift(model)
          this.data.unshift(model.data)
        } else {
          const skipSort = lastItem && lastItem[orderKey] > data[orderKey]
          this.children.push(model)
          this.data.push(model.data)
          if (!skipSort) this.markAndSort()
        }
      }
      if (overflow) {
        if (first) {
          rmodel = this.children.pop()!
          this.data.pop()
        } else {
          rmodel = this.children.shift()!
          this.data.shift()
        }
        rmodel.release()
      }
      this.onChange([model.id], model.data)
      if (rmodel) this.onChange([rmodel.id], null)
    }).catch(e => {
      console.error(`failed to load ${className}:${id} ${e}`)
    })
  }
  markAndSort() {
    this.mark()
    const orderKey = this.aliasOrderKey
    if (this.ordering.direction === 'asc') {
      this.children.sort((a, b) => a.data[orderKey] < b.data[orderKey] ? -1 : +1)
      this.data.sort((a, b) => a[orderKey] < b[orderKey] ? -1 : +1)
    } else {
      this.children.sort((a, b) => a.data[orderKey] > b.data[orderKey] ? -1 : +1)
      this.data.sort((a, b) => a[orderKey] > b[orderKey] ? -1 : +1)
    }
  }
  consumeRemove(id: IDType) {
    const idx = this.children.findIndex(a => a.id === id)
    this.fetching.delete(id) // To cancel consumeAdd
    if (idx < 0) return
    this.mark()
    this.children[idx].release()
    this.children.splice(idx, 1)
    this.data.splice(idx, 1)
    this.onChange([id], null)
  }
  onNotify(notifyData: NotifyData) {
    if (notifyData.action === 'add') {
      this.consumeAdd(notifyData.class, notifyData.id)
    } else if (notifyData.action === 'remove') {
      this.consumeRemove(notifyData.id)
    }
  }
  subscribeAll() {
    const callback = data => this.onNotify(data)
    for (const key of this.syncKeys) this.subscribe(key, callback)
  }
  onChange(path: (string | number)[], data) {
    super.onChange(path, data)
    if (path[1] === this.aliasOrderKey) this.markAndSort()
  }
  markAndSet(id: IDType, data) {
    this.mark()
    const idx = this.children.findIndex(a => a.id === id)
    if (idx >= 0) this.data[idx] = data
  }
  mark() {
    if (!this.root || !this.root.immutable || !Object.isFrozen(this.data)) return
    this.data = [...this.data]
    this.root.mark(this.data)
    if (this.parentModel && this.parentKey) (this.parentModel as { markAndSet(key: string | number, data: any): any }).markAndSet(this.parentKey, this.data)
  }
}

export class ArSyncStore {
  immutable: boolean
  markedForFreezeObjects: any[]
  changes
  eventListeners
  markForRelease: true | undefined
  container
  request: Request
  complete = false
  notfound?: boolean
  destroyed = false
  data
  changesBufferTimer: number | undefined | null
  retryLoadTimer: number | undefined | null
  static connectionManager
  constructor(request: Request, { immutable } = {} as { immutable?: boolean }) {
    this.immutable = !!immutable
    this.markedForFreezeObjects = []
    this.changes = []
    this.eventListeners = { events: {}, serial: 0 }
    this.request = request
    this.data = null
    this.load(0)
  }
  handleDestroy() {
    this.release()
    this.data = null
    this.destroyed = true
    this.trigger('destroy')
  }
  load(retryCount: number) {
    ArSyncContainerBase.load(this.request, this).then((container: ArSyncContainerBase) => {
      if (this.markForRelease) {
        container.release()
        return
      }
      this.container = container
      this.data = container.data
      if (this.immutable) this.freezeRecursive(this.data)
      this.complete = true
      this.notfound = false
      this.trigger('load')
      this.trigger('change', { path: [], value: this.data })
      container.onChange = (path, value) => {
        this.changes.push({ path, value })
        this.setChangesBufferTimer()
      }
      container.onConnectionChange = state => {
        this.trigger('connection', state)
      }
    }).catch(e => {
      if (!e || e.retry === undefined) throw e
      if (this.markForRelease) return
      if (!e.retry) {
        this.complete = true
        this.notfound = true
        this.trigger('load')
        return
      }
      const sleepSeconds = Math.min(Math.pow(2, retryCount), 30)
      this.retryLoadTimer = setTimeout(
        () => {
          this.retryLoadTimer = null
          this.load(retryCount + 1)
        },
        sleepSeconds * 1000
      )
    })
  }
  setChangesBufferTimer() {
    if (this.changesBufferTimer) return
    this.changesBufferTimer = setTimeout(() => {
      this.changesBufferTimer = null
      const changes = this.changes
      this.changes = []
      this.freezeMarked()
      this.data = this.container.data
      changes.forEach(patch => this.trigger('change', patch))
    }, 20)
  }
  subscribe(event, callback) {
    let listeners = this.eventListeners.events[event]
    if (!listeners) this.eventListeners.events[event] = listeners = {}
    const id = this.eventListeners.serial++
    listeners[id] = callback
    return { unsubscribe: () => { delete listeners[id] } }
  }
  trigger(event, arg?) {
    const listeners = this.eventListeners.events[event]
    if (!listeners) return
    for (const id in listeners) listeners[id](arg)
  }
  mark(object) {
    this.markedForFreezeObjects.push(object)
  }
  freezeRecursive(obj) {
    if (Object.isFrozen(obj)) return obj
    for (const key in obj) this.freezeRecursive(obj[key])
    Object.freeze(obj)
  }
  freezeMarked() {
    this.markedForFreezeObjects.forEach(obj => this.freezeRecursive(obj))
    this.markedForFreezeObjects = []
  }
  release() {
    if (this.retryLoadTimer) clearTimeout(this.retryLoadTimer)
    if (this.changesBufferTimer) clearTimeout(this.changesBufferTimer)
    if (this.container) {
      this.container.release()
    } else {
      this.markForRelease = true
    }
  }
}
