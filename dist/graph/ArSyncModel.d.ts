import ArSyncModelBase from '../ArSyncModelBase';
export default class ArSyncModel<T> extends ArSyncModelBase<T> {
    static setConnectionAdapter(adapter: any): void;
    static createRefModel(request: any, option: any): any;
    refManagerClass(): typeof ArSyncModel;
    connectionManager(): any;
    static _cache: {};
    static cacheTimeout: number;
}
