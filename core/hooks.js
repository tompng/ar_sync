"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ArSyncApi_1 = require("./ArSyncApi");
const ArSyncModel_1 = require("./ArSyncModel");
let useState;
let useEffect;
let useMemo;
function initializeHooks(hooks) {
    useState = hooks.useState;
    useEffect = hooks.useEffect;
    useMemo = hooks.useMemo;
}
exports.initializeHooks = initializeHooks;
function checkHooks() {
    if (!useState)
        throw 'uninitialized. needs `initializeHooks({ useState, useEffect, useMemo })`';
}
const initialResult = [null, { complete: false, notfound: undefined, connected: true }];
function useArSyncModel(request) {
    checkHooks();
    const [result, setResult] = useState(initialResult);
    const requestString = JSON.stringify(request && request.params);
    useEffect(() => {
        if (!request) {
            setResult(initialResult);
            return () => { };
        }
        const model = new ArSyncModel_1.default(request, { immutable: true });
        function update() {
            const { complete, notfound, connected, data } = model;
            setResult(resultWas => {
                const [, statusWas] = resultWas;
                const statusPersisted = statusWas.complete === complete && statusWas.notfound === notfound && statusWas.connected === connected;
                const status = statusPersisted ? statusWas : { complete, notfound, connected };
                return [data, status];
            });
        }
        if (model.complete) {
            update();
        }
        else {
            setResult(initialResult);
        }
        model.subscribe('change', update);
        model.subscribe('connection', update);
        return () => model.release();
    }, [requestString]);
    return result;
}
exports.useArSyncModel = useArSyncModel;
const initialFetchState = { data: null, status: { complete: false, notfound: undefined } };
function useArSyncFetch(request) {
    checkHooks();
    const [state, setState] = useState(initialFetchState);
    const requestString = JSON.stringify(request && request.params);
    const loader = useMemo(() => {
        let lastLoadId = 0;
        let timer = null;
        function cancel() {
            if (timer)
                clearTimeout(timer);
            timer = null;
            lastLoadId++;
        }
        function fetch(request, retryCount) {
            cancel();
            const currentLoadingId = lastLoadId;
            ArSyncApi_1.default.fetch(request).then((response) => {
                if (currentLoadingId !== lastLoadId)
                    return;
                setState({ data: response, status: { complete: true, notfound: false } });
            }).catch(e => {
                if (currentLoadingId !== lastLoadId)
                    return;
                if (!e.retry) {
                    setState({ data: null, status: { complete: true, notfound: true } });
                    return;
                }
                timer = setTimeout(() => fetch(request, retryCount + 1), 1000 * Math.min(4 ** retryCount, 30));
            });
        }
        function update() {
            if (request) {
                setState(state => {
                    const { data, status } = state;
                    if (!status.complete && status.notfound === undefined)
                        return state;
                    return { data, status: { complete: false, notfound: undefined } };
                });
                fetch(request, 0);
            }
            else {
                setState(initialFetchState);
            }
        }
        return { update, cancel };
    }, [requestString]);
    useEffect(() => {
        setState(initialFetchState);
        loader.update();
        return () => loader.cancel();
    }, [requestString]);
    return [state.data, state.status, loader.update];
}
exports.useArSyncFetch = useArSyncFetch;
