"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
function apiBatchFetch(endpoint, requests) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, body, option, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    };
                    body = JSON.stringify({ requests: requests });
                    option = { credentials: 'include', method: 'POST', headers: headers, body: body };
                    if (ArSyncApi.domain)
                        endpoint = ArSyncApi.domain + endpoint;
                    return [4 /*yield*/, fetch(endpoint, option)];
                case 1:
                    res = _a.sent();
                    if (res.status === 200)
                        return [2 /*return*/, res.json()];
                    throw new Error(res.statusText);
            }
        });
    });
}
var ApiFetcher = /** @class */ (function () {
    function ApiFetcher(endpoint) {
        this.batches = [];
        this.batchFetchTimer = null;
        this.endpoint = endpoint;
    }
    ApiFetcher.prototype.fetch = function (request) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.batches.push([request, { resolve: resolve, reject: reject }]);
            if (_this.batchFetchTimer)
                return;
            _this.batchFetchTimer = setTimeout(function () {
                _this.batchFetchTimer = null;
                var compacts = {};
                var requests = [];
                var callbacksList = [];
                for (var _i = 0, _a = _this.batches; _i < _a.length; _i++) {
                    var batch = _a[_i];
                    var request_1 = batch[0];
                    var callback = batch[1];
                    var key = JSON.stringify(request_1);
                    if (compacts[key]) {
                        compacts[key].push(callback);
                    }
                    else {
                        requests.push(request_1);
                        callbacksList.push(compacts[key] = [callback]);
                    }
                }
                _this.batches = [];
                ArSyncApi._batchFetch(_this.endpoint, requests).then(function (results) {
                    for (var i in callbacksList) {
                        var result = results[i];
                        var callbacks = callbacksList[i];
                        for (var _i = 0, callbacks_1 = callbacks; _i < callbacks_1.length; _i++) {
                            var callback = callbacks_1[_i];
                            if (result.data) {
                                callback.resolve(result.data);
                            }
                            else {
                                var error = result.error || { type: 'Unknown Error' };
                                callback.reject(__assign(__assign({}, error), { retry: false }));
                            }
                        }
                    }
                }).catch(function (e) {
                    var error = { type: e.name, message: e.message, retry: true };
                    for (var _i = 0, callbacksList_1 = callbacksList; _i < callbacksList_1.length; _i++) {
                        var callbacks = callbacksList_1[_i];
                        for (var _a = 0, callbacks_2 = callbacks; _a < callbacks_2.length; _a++) {
                            var callback = callbacks_2[_a];
                            callback.reject(error);
                        }
                    }
                });
            }, 16);
        });
    };
    return ApiFetcher;
}());
var staticFetcher = new ApiFetcher('/static_api');
var syncFetcher = new ApiFetcher('/sync_api');
var ArSyncApi = {
    domain: null,
    _batchFetch: apiBatchFetch,
    fetch: function (request) { return staticFetcher.fetch(request); },
    syncFetch: function (request) { return syncFetcher.fetch(request); },
};
exports.default = ArSyncApi;
