import ArSyncModelBase from '../core/ArSyncModelBase';
import ConnectionAdapter from '../core/ConnectionAdapter';
export default class ArSyncModel<T> extends ArSyncModelBase<T> {
    static setConnectionAdapter(adapter: ConnectionAdapter): void;
    static createRefModel(request: any, option: any): any;
    refManagerClass(): typeof ArSyncModel;
    connectionManager(): any;
    static _cache: {};
    static cacheTimeout: number;
}
