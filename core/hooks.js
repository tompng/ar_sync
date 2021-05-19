"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useArSyncFetch = exports.useArSyncModel = exports.initializeHooks = void 0;
var ArSyncApi_1 = require("./ArSyncApi");
var ArSyncModel_1 = require("./ArSyncModel");
var useState;
var useEffect;
var useMemo;
var useRef;
function initializeHooks(hooks) {
    useState = hooks.useState;
    useEffect = hooks.useEffect;
    useMemo = hooks.useMemo;
    useRef = hooks.useRef;
}
exports.initializeHooks = initializeHooks;
function checkHooks() {
    if (!useState)
        throw 'uninitialized. needs `initializeHooks({ useState, useEffect, useMemo, useRef })`';
}
var initialResult = [null, { complete: false, notfound: undefined, connected: true }];
function useArSyncModel(request) {
    var _a;
    checkHooks();
    var _b = useState(initialResult), result = _b[0], setResult = _b[1];
    var requestString = JSON.stringify((_a = request === null || request === void 0 ? void 0 : request.id) !== null && _a !== void 0 ? _a : request === null || request === void 0 ? void 0 : request.params);
    var prevRequestStringRef = useRef(requestString);
    useEffect(function () {
        prevRequestStringRef.current = requestString;
        if (!request) {
            setResult(initialResult);
            return function () { };
        }
        var model = new ArSyncModel_1.default(request, { immutable: true });
        function update() {
            var complete = model.complete, notfound = model.notfound, connected = model.connected, data = model.data;
            setResult(function (resultWas) {
                var dataWas = resultWas[0], statusWas = resultWas[1];
                var statusPersisted = statusWas.complete === complete && statusWas.notfound === notfound && statusWas.connected === connected;
                if (dataWas === data && statusPersisted)
                    return resultWas;
                var status = statusPersisted ? statusWas : { complete: complete, notfound: notfound, connected: connected };
                return [data, status];
            });
        }
        if (model.complete) {
            update();
        }
        else {
            setResult(initialResult);
        }
        model.subscribe('load', update);
        model.subscribe('change', update);
        model.subscribe('connection', update);
        return function () { return model.release(); };
    }, [requestString]);
    return prevRequestStringRef.current === requestString ? result : initialResult;
}
exports.useArSyncModel = useArSyncModel;
var initialFetchState = { data: null, status: { complete: false, notfound: undefined } };
function extractParams(query, output) {
    if (output === void 0) { output = []; }
    if (typeof (query) !== 'object' || query == null || Array.isArray(query))
        return output;
    if ('params' in query)
        output.push(query.params);
    for (var key in query) {
        extractParams(query[key], output);
    }
    return output;
}
function useArSyncFetch(request) {
    var _a;
    checkHooks();
    var _b = useState(initialFetchState), state = _b[0], setState = _b[1];
    var query = request && request.query;
    var resourceIdentifier = (_a = request === null || request === void 0 ? void 0 : request.id) !== null && _a !== void 0 ? _a : request === null || request === void 0 ? void 0 : request.params;
    var requestString = useMemo(function () {
        return JSON.stringify(extractParams(query, [resourceIdentifier]));
    }, [query, resourceIdentifier]);
    var prevRequestStringRef = useRef(requestString);
    var loader = useMemo(function () {
        var lastLoadId = 0;
        var timer = null;
        function cancel() {
            if (timer)
                clearTimeout(timer);
            timer = null;
            lastLoadId++;
        }
        function fetch(request, retryCount) {
            cancel();
            var currentLoadingId = lastLoadId;
            ArSyncApi_1.default.fetch(request).then(function (response) {
                if (currentLoadingId !== lastLoadId)
                    return;
                setState({ data: response, status: { complete: true, notfound: false } });
            }).catch(function (e) {
                if (currentLoadingId !== lastLoadId)
                    return;
                if (!e.retry) {
                    setState({ data: null, status: { complete: true, notfound: true } });
                    return;
                }
                timer = setTimeout(function () { return fetch(request, retryCount + 1); }, 1000 * Math.min(Math.pow(4, retryCount), 30));
            });
        }
        function update() {
            if (request) {
                setState(function (state) {
                    var data = state.data, status = state.status;
                    if (!status.complete && status.notfound === undefined)
                        return state;
                    return { data: data, status: { complete: false, notfound: undefined } };
                });
                fetch(request, 0);
            }
            else {
                setState(initialFetchState);
            }
        }
        return { update: update, cancel: cancel };
    }, [requestString]);
    useEffect(function () {
        prevRequestStringRef.current = requestString;
        setState(initialFetchState);
        loader.update();
        return function () { return loader.cancel(); };
    }, [requestString]);
    var responseState = prevRequestStringRef.current === requestString ? state : initialFetchState;
    return [responseState.data, responseState.status, loader.update];
}
exports.useArSyncFetch = useArSyncFetch;
