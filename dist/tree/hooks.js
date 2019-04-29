"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var hooksBase_1 = require("../hooksBase");
exports.useArSyncFetch = hooksBase_1.useArSyncFetch;
const hooksBase_2 = require("../hooksBase");
const ArSyncModel_1 = require("./ArSyncModel");
function useArSyncModel(request) {
    return hooksBase_2.useArSyncModelWithClass(ArSyncModel_1.default, request);
}
exports.useArSyncModel = useArSyncModel;
