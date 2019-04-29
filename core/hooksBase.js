"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const ArSyncApi_1 = require("./ArSyncApi");
function useArSyncModelWithClass(modelClass, request) {
    const [data, setData] = react_1.useState(null);
    const [status, setStatus] = react_1.useState({ complete: false, connected: true });
    const updateStatus = (complete, notfound, connected) => {
        if (complete === status.complete || notfound === status.notfound || connected === status.notfound)
            return;
        setStatus({ complete, notfound, connected });
    };
    react_1.useEffect(() => {
        if (!request)
            return () => { };
        const model = new modelClass(request, { immutable: true });
        if (model.complete)
            setData(model.data);
        updateStatus(model.complete, model.notfound, model.connected);
        model.subscribe('change', () => {
            updateStatus(model.complete, model.notfound, model.connected);
            setData(model.data);
        });
        model.subscribe('connection', () => {
            updateStatus(model.complete, model.notfound, model.connected);
        });
        return () => model.release();
    }, [JSON.stringify(request && request.params)]);
    return [data, status];
}
exports.useArSyncModelWithClass = useArSyncModelWithClass;
function useArSyncFetch(request) {
    const [response, setResponse] = react_1.useState(null);
    const [status, setStatus] = react_1.useState({ complete: false });
    const requestString = JSON.stringify(request && request.params);
    let canceled = false;
    let timer = null;
    const update = react_1.useCallback(() => {
        if (!request) {
            setStatus({ complete: false, notfound: undefined });
            return () => { };
        }
        canceled = false;
        timer = null;
        const fetch = (count) => {
            if (timer)
                clearTimeout(timer);
            timer = null;
            ArSyncApi_1.default.fetch(request)
                .then((response) => {
                if (canceled)
                    return;
                setResponse(response);
                setStatus({ complete: true, notfound: false });
            })
                .catch(e => {
                if (canceled)
                    return;
                if (!e.retry) {
                    setResponse(null);
                    setStatus({ complete: true, notfound: true });
                    return;
                }
                timer = setTimeout(() => fetch(count + 1), 1000 * Math.min(4 ** count, 30));
            });
        };
        fetch(0);
    }, [requestString]);
    react_1.useEffect(() => {
        update();
        return () => {
            canceled = true;
            if (timer)
                clearTimeout(timer);
            timer = null;
        };
    }, [requestString]);
    return [response, status, update];
}
exports.useArSyncFetch = useArSyncFetch;
