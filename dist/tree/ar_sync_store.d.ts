export default class ArSyncStore {
    data: any;
    query: any;
    immutable: any;
    constructor(query: any, data: any, option?: {
        immutable?: boolean | undefined;
    });
    replaceData(data: any): void;
    batchUpdate(patches: any): {
        changes: any;
        events: never[];
    };
    update(patch: any): {
        changes: any;
        events: never[];
    };
    _slicePatch(patchData: any, query: any): {};
    _applyPatch(data: any, accessKeys: any, actualPath: any, updator: any, query: any, patchData: any): void;
    _update(patch: any, updator: any, events: any): void;
    static parseQuery(query: any, attrsonly?: any): {};
}
