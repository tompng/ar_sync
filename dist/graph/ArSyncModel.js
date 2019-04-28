"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ArSyncStore_1 = require("./ArSyncStore");
const ConnectionManager_1 = require("../ConnectionManager");
const ArSyncModelBase_1 = require("../ArSyncModelBase");
class ArSyncModel extends ArSyncModelBase_1.default {
    static setConnectionAdapter(adapter) {
        ArSyncStore_1.default.connectionManager = new ConnectionManager_1.default(adapter);
    }
    static createRefModel(request, option) {
        return new ArSyncStore_1.default(request, option);
    }
    refManagerClass() {
        return ArSyncModel;
    }
    connectionManager() {
        return ArSyncStore_1.default.connectionManager;
    }
}
ArSyncModel._cache = {};
ArSyncModel.cacheTimeout = 10 * 1000;
exports.default = ArSyncModel;
