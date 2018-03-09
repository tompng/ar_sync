const { ArSyncStore } = require('../index.js')
function dup(obj) { return JSON.parse(JSON.stringify(obj)) }
function selectPatch(patches, keys) {
  return dup(patches).filter(arr => keys.indexOf(arr.key) >= 0)
}

function compareObject(a, b, path, key){
  if (!path) path = []
  if (key) (path = [].concat(path)).push(key)
  function log(message) {
    console.log(`${path.join('/')} ${message}`)
  }
  function withmessage(val){
    if (!val) log(`${JSON.stringify(a)} != ${JSON.stringify(b)}`)
    return val
  }
  if (a === b) return true
  if (!a || !b) return withmessage(false)
  if (a.constructor !== b.constructor) return withmessage(false)
  if (a.constructor === Array) {
    const len = Math.max(a.length, b.length)
    for (let i=0; i<len; i++) {
      if (i >= a.length || i >= b.length) {
        log(`at index ${i}: ${JSON.stringify(a[i])} != ${JSON.stringify(b[i])})}`)
        return false
      }
      if (!compareObject(a[i], b[i], path, i)) return false
    }
  } else if (a.constructor === Object) {
    const akeys = Object.keys(a).sort()
    const bkeys = Object.keys(b).sort()
    if (akeys.join('') != bkeys.join('')) {
      log(`keys: ${JSON.stringify(akeys)} != ${JSON.stringify(bkeys)}`)
      return false
    }
    for (const i in a) {
      if (!compareObject(a[i], b[i], path, i)) return false
    }
  } else {
    return withmessage(a === b)
  }
  return true
}

function selectPatch(patches, keys) {
  return dup(patches).filter(arr => keys.indexOf(arr.key) >= 0)
}

function executeTest({ names, queries, keysList, initials, tests }) {
  for (const i in names) {
    const query = queries[i]
    const initial = initials[i]
    const { limit, order } = initial
    for (const immutable of [true, false]) {
      console.log(`Test: ${names[i]}${immutable ? ' immutable' : ''}`)
      try {
        const store = new ArSyncStore(query, dup(initial.data), { immutable, limit, order })
        for (const { patches, states } of tests) {
          const dataWas = store.data
          const dataWasCloned = dup(dataWas)
          store.batchUpdate(selectPatch(patches, initial.keys))
          const state = states[i]
          console.log(compareObject(store.data, state))
          if (immutable) console.log(compareObject(dataWas, dataWasCloned))
        }
      } catch (e) {
        console.log(e)
        console.log(false)
      }
    }
  }
}

module.exports = executeTest
