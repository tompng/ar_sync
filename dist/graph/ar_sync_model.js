"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ar_sync_store_1 = require("./ar_sync_store");
const connection_manager_1 = require("../connection_manager");
const ar_sync_model_base_1 = require("../ar_sync_model_base");
class ArSyncModel extends ar_sync_model_base_1.default {
    static setConnectionAdapter(adapter) {
        ar_sync_store_1.default.connectionManager = new connection_manager_1.default(adapter);
    }
    static createRefModel(request, option) {
        return new ar_sync_store_1.default(request, option);
    }
    refManagerClass() {
        return ArSyncModel;
    }
}
ArSyncModel._cache = {};
ArSyncModel.cacheTimeout = 10 * 1000;
exports.default = ArSyncModel;
