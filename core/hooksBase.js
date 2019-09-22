"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const ArSyncApi_1 = require("./ArSyncApi");
const initialResult = [null, { complete: false, notfound: undefined, connected: true }];
function useArSyncModelWithClass(modelClass, request) {
    const [result, setResult] = react_1.useState(initialResult);
    const requestString = JSON.stringify(request && request.params);
    react_1.useEffect(() => {
        if (!request) {
            setResult(initialResult);
            return () => { };
        }
        const model = new modelClass(request, { immutable: true });
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
exports.useArSyncModelWithClass = useArSyncModelWithClass;
const initialFetchState = { data: null, status: { complete: false, notfound: undefined } };
function useArSyncFetch(request) {
    const [state, setState] = react_1.useState(initialFetchState);
    const requestString = JSON.stringify(request && request.params);
    const loader = react_1.useMemo(() => {
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
                fetch(request, 0);
            }
            else {
                setState(initialFetchState);
            }
        }
        return { update, cancel };
    }, [requestString]);
    react_1.useEffect(() => {
        setState(initialFetchState);
        loader.update();
        return () => loader.cancel();
    }, [requestString]);
    return [state.data, state.status, loader.update];
}
exports.useArSyncFetch = useArSyncFetch;
