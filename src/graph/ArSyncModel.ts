import ArSyncStore from './ArSyncStore'
import ArSyncConnectionManager from '../ConnectionManager'
import ArSyncModelBase from '../ArSyncModelBase'

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
  connectionManager() {
    return ArSyncStore.connectionManager
  }
  static _cache = {}
  static cacheTimeout = 10 * 1000
}
