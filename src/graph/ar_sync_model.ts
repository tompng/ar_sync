import ArSyncStore from './ar_sync_store'
import ArSyncConnectionManager from '../connection_manager'
import ArSyncModelBase from '../ar_sync_model_base'

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

export default ArSyncModel
