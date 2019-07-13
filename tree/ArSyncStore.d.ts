export default class ArSyncStore {
    data: any;
    request: any;
    immutable: any;
    constructor(request: any, data: any, option?: {
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
    _slicePatch(patchData: any, query: any): any;
    _applyPatch(data: any, accessKeys: any, actualPath: any, updator: any, query: any, patchData: any): void;
    _update(patch: {
        action: string;
        path: (string | number)[];
        ordering: any;
        data: any;
    }, updator: any, events: any): void;
}
