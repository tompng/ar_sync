'use strict'
const readline = require('readline')
const input = readline.createInterface({ input: process.stdin })
const ConnectionAdapter = new require('./connection_adapter')
const ArSyncModel = require('../../graph/ArSyncModel')
const ArSyncApi = require('../../core/ArSyncApi')
const connectionAdapter = new ConnectionAdapter
ArSyncModel.connectionAdapter = connectionAdapter

const waitingCallbacks = {}
ArSyncApi._batchFetch = (_, requests) => {
  const key = Math.random()
  const data = { type: 'request', key: key, data: requests }
  process.stdout.write(JSON.stringify(data) + '\n')
  return new Promise(res => {
    waitingCallbacks[key] = (data) => {
      delete waitingCallbacks[key]
      res(data)
    }
  })
}

input.on('line', line => {
  const e = JSON.parse(line)
  switch (e.type) {
    case 'eval': {
      let result, error, responseJSON
      try {
        const res = eval(e.data)
        result = res && res.constructor && `[${res.constructor.name}]`
        JSON.stringify(res)
        result = res
      } catch (e) {
        error = e.message
      }
      const data = {
        type: 'result',
        key: e.key,
        result,
        error
      }
      process.stdout.write(JSON.stringify(data) + '\n')
      break
    }
    case 'response': {
      const cb = waitingCallbacks[e.key]
      if (cb) cb(e.data)
      break
    }
    case 'notify': {
      connectionAdapter.notify(e.key, e.data)
      break
    }
  }
})
