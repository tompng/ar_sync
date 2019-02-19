(function(){

class ArSyncModelBase {
  constructor(request, option) {
    this._ref = this.refManagerClass().retrieveRef(request, option)
    this._listenerSerial = 0
    this._listeners = {}
    const setData = () => {
      this.data = this._ref.model.data
      this.loaded = this._ref.model.loaded
    }
    setData()
    this.subscribe('load', setData)
    this.subscribe('change', setData)
  }
  onload(callback) {
    this.subscribeOnce('load', callback)
  }
  subscribeOnce(event, callback) {
    const subscription = this.subscribe('load', () => {
      callback()
      subscription.unsubscribe()
    })
    return subscription
  }
  subscribe(event, callback) {
    const id = this._listenerSerial++
    const subscription = this._ref.model.subscribe(event, callback)
    const unsubscribe = () => {
      callback = null
      subscription.unsubscribe()
      delete this._listeners[id]
    }
    if (this.loaded) {
      const cb = () => { if (callback) callback({ path: [], value: this.data }) }
      if (event === 'load') setTimeout(cb, 0)
      if (event === 'change') setTimeout(cb, 0)
    }
    return this._listeners[id] = { unsubscribe }
  }
  release() {
    for (const id in this._listeners) this._listeners[id].unsubscribe()
    this._listeners = {}
    this.refManagerClass()._detach(this._ref)
    this._ref = null
  }
  dig(data, path) {
    return this._ref.model.store.dig(data, path)
  }
  static retrieveRef(request, option) {
    const key = JSON.stringify([request, option])
    let ref = this._cache[key]
    if (!ref) {
      const model = this.createRefModel(request, option)
      ref = this._cache[key] = { key, count: 0, timer: null, model }
    }
    this._attach(ref)
    return ref
  }
  static _detach(ref) {
    ref.count--
    const timeout = this.cacheTimeout
    if (ref.count !== 0) return
    const timedout = () => {
      ref.model.release()
      delete this._cache[ref.key]
    }
    if (timeout) {
      ref.timer = setTimeout(timedout, timeout)
    } else {
      timedout()
    }
  }
  static _attach(ref) {
    ref.count++
    if (ref.timer) clearTimeout(ref.timer)
  }
  static waitForLoad(...models) {
    return new Promise((resolve) => {
      let count = 0
      for (const model of models) {
        model.onload(() => {
          count++
          if (models.length == count) resolve(models)
        })
      }
    })
  }
}

try {
  module.exports = ArSyncModelBase
} catch (e) {
  window.ArSyncModelBase = ArSyncModelBase
}
})()
