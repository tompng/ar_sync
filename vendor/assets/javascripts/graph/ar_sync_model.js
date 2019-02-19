(function(){
let ArSyncStore, ArSyncConnectionManager, ArSyncModelBase
try {
  ArSyncStore = require('./ar_sync_store').ArSyncStore
  ArSyncConnectionManager = require('../ar_sync_connection_manager')
  ArSyncModelBase = require('../ar_sync_model_base')
} catch(e) {
  ArSyncStore = window.ArSyncStore
  ArSyncConnectionManager = window.ArSyncConnectionManager
  ArSyncModelBase = window.ArSyncModelBase
}

class ArSyncModel extends ArSyncModelBase {
  static setConnectionAdapter(adapter) {
    ArSyncStore.connectionManager = new ArSyncConnectionManager(adapter)
  }
  static createRefModel(request, option) {
    return new ArSyncStore(request, option)
  }
  refManagerClass() {
    return ArSyncModel
  }
}
ArSyncModel._cache = {}
ArSyncModel.cacheTimeout = 10 * 1000

try {
  module.exports = { ArSyncModel, ArSyncStore }
} catch (e) {
  window.ArSyncModel = ArSyncModel
  window.ArSyncStore = ArSyncStore
}
})()
