import ArSyncStore from './ar_sync_store'
import ArSyncConnectionManager from '../connection_manager'
import ArSyncModelBase from '../ar_sync_model_base'

export default class ArSyncModel<T> extends ArSyncModelBase<T> {
  static setConnectionAdapter(adapter) {
    ArSyncStore.connectionManager = new ArSyncConnectionManager(adapter)
  }
  static createRefModel(request, option): any {
    return new ArSyncStore(request, option)
  }
  refManagerClass() {
    return ArSyncModel
  }
  static _cache = {}
  static cacheTimeout = 10 * 1000
}
