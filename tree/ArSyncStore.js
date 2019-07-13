"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseRequest_1 = require("../core/parseRequest");
class Updator {
    constructor(immutable) {
        this.changes = [];
        this.markedForFreezeObjects = [];
        this.immutable = immutable;
    }
    static createFrozenObject(obj) {
        if (!obj)
            return obj;
        if (obj.constructor === Array) {
            obj = obj.map(el => Updator.createFrozenObject(el));
        }
        else if (typeof obj === 'object') {
            obj = Object.assign({}, obj);
            for (const key in obj) {
                obj[key] = Updator.createFrozenObject(obj[key]);
            }
        }
        Object.freeze(obj);
        return obj;
    }
    replaceData(data, newData) {
        if (this.immutable)
            return Updator.createFrozenObject(newData);
        return this.recursivelyReplaceData(data, newData);
    }
    recursivelyReplaceData(data, newData) {
        const replaceArray = (as, bs) => {
            const aids = {};
            for (const a of as) {
                if (!a.id)
                    return false;
                aids[a.id] = a;
            }
            const order = {};
            bs.forEach((b, i) => {
                if (!b.id)
                    return false;
                if (aids[b.id]) {
                    replaceObject(aids[b.id], b);
                }
                else {
                    as.push(b);
                }
                order[b.id] = i + 1;
            });
            as.sort((a, b) => {
                const oa = order[a.id] || Infinity;
                const ob = order[b.id] || Infinity;
                return oa > ob ? +1 : oa < ob ? -1 : 0;
            });
            while (as.length && !order[as[as.length - 1].id])
                as.pop();
            return true;
        };
        const replaceObject = (aobj, bobj) => {
            const keys = {};
            for (const key in aobj)
                keys[key] = true;
            for (const key in bobj)
                keys[key] = true;
            for (const key in keys) {
                const a = aobj[key];
                const b = bobj[key];
                if ((a instanceof Array) && (b instanceof Array)) {
                    if (!replaceArray(a, b))
                        aobj[key] = b;
                }
                else if (a && b && (typeof a === 'object') && (typeof b === 'object') && !(a instanceof Array) && !(b instanceof Array)) {
                    replaceObject(a, b);
                }
                else if (a !== b) {
                    aobj[key] = b;
                }
            }
        };
        replaceObject(data, newData);
        return data;
    }
    mark(obj) {
        if (!this.immutable)
            return obj;
        if (!Object.isFrozen(this.data))
            return obj;
        const mobj = (obj.constructor === Array) ? [...obj] : Object.assign({}, obj);
        this.markedForFreezeObjects.push(mobj);
        return mobj;
    }
    trace(data, path) {
        path.forEach(key => {
            if (this.immutable)
                data[key] = this.mark(data[key]);
            data = data[key];
        });
        return data;
    }
    assign(el, path, column, value, orderParam) {
        if (this.immutable)
            value = Updator.createFrozenObject(value);
        if (el.constructor === Array && !el[column]) {
            this.changes.push({
                path: path.concat([value.id]),
                target: el,
                id: value.id,
                valueWas: null,
                value
            });
            const limitReached = orderParam && orderParam.limit != null && el.length === orderParam.limit;
            let removed;
            if (orderParam && orderParam.order == 'desc') {
                el.unshift(value);
                if (limitReached)
                    removed = el.pop();
            }
            else {
                el.push(value);
                if (limitReached)
                    removed = el.pop();
            }
            if (removed)
                this.changes.push({
                    path: path.concat([removed.id]),
                    target: el,
                    id: removed.id,
                    valueWas: removed,
                    value: null
                });
        }
        else if (!this.valueEquals(el[column], value)) {
            this.changes.push({
                path: path.concat([column]),
                target: el,
                column: column,
                valueWas: el[column],
                value
            });
            el[column] = value;
        }
    }
    valueEquals(a, b) {
        if (a === b)
            return true;
        if (!a || !b)
            return a == b;
        if (typeof a !== 'object')
            return false;
        if (typeof b !== 'object')
            return false;
        const ja = JSON.stringify(a);
        const jb = JSON.stringify(b);
        return ja === jb;
    }
    add(tree, accessKeys, path, column, value, orderParam) {
        const root = this.mark(tree);
        const data = this.trace(root, accessKeys);
        if (data)
            this.assign(data, path, column, value, orderParam);
        return root;
    }
    remove(tree, accessKeys, path, column) {
        const root = this.mark(tree);
        let data = this.trace(root, accessKeys);
        if (!data)
            return root;
        if (data.constructor === Array) {
            this.changes.push({
                path: path.concat([data[column].id]),
                target: data,
                id: data[column].id,
                valueWas: data[column],
                value: null
            });
            data.splice(column, 1);
        }
        else if (data[column] !== null) {
            this.changes.push({
                path: path.concat([column]),
                target: data,
                column: column,
                valueWas: data[column],
                value: null
            });
            data[column] = null;
        }
        return root;
    }
    cleanup() {
        this.markedForFreezeObjects.forEach(mobj => Object.freeze(mobj));
    }
}
class ArSyncStore {
    constructor(request, data, option = {}) {
        this.data = option.immutable ? Updator.createFrozenObject(data) : data;
        this.request = parseRequest_1.parseRequest(request);
        this.immutable = option.immutable;
    }
    replaceData(data) {
        this.data = new Updator(this.immutable).replaceData(this.data, data);
    }
    batchUpdate(patches) {
        const events = [];
        const updator = new Updator(this.immutable);
        patches.forEach(patch => this._update(patch, updator, events));
        updator.cleanup();
        return { changes: updator.changes, events };
    }
    update(patch) {
        return this.batchUpdate([patch]);
    }
    _slicePatch(patchData, query) {
        const obj = query && query['*'] ? Object.assign({}, patchData) : {};
        for (const key in query) {
            const fieldQuery = query[key];
            const field = (fieldQuery && fieldQuery.field) || key;
            if (field in patchData)
                obj[key] = patchData[field];
        }
        if (patchData.id)
            obj.id = patchData.id;
        return obj;
    }
    _applyPatch(data, accessKeys, actualPath, updator, query, patchData) {
        for (const key in patchData) {
            const subq = query[key];
            const value = patchData[(subq && subq.field) || key];
            if (subq || query['*']) {
                if (data[key] !== value) {
                    this.data = updator.add(this.data, accessKeys, actualPath, key, value);
                }
            }
        }
    }
    _update(patch, updator, events) {
        const { action, path } = patch;
        const patchData = patch.data;
        let request = this.request;
        let data = this.data;
        const trace = (i, actualPath, accessKeys, query, data) => {
            const nameOrId = path[i];
            const lastStep = i === path.length - 1;
            if (typeof (nameOrId) === 'number') {
                const idx = data.findIndex(o => o.id === nameOrId);
                if (lastStep) {
                    apply(accessKeys, actualPath, query, null, idx, data[idx]);
                }
                else {
                    if (idx < 0)
                        return;
                    actualPath.push(nameOrId);
                    accessKeys.push(idx);
                    const data2 = data[idx];
                    trace(i + 1, actualPath, accessKeys, query, data2);
                }
            }
            else {
                const matchedKeys = [];
                for (const key in query) {
                    const field = query[key].field || key;
                    if (field === nameOrId)
                        matchedKeys.push(key);
                }
                const fork = matchedKeys.length > 1;
                for (const key of matchedKeys) {
                    const queryField = query[key];
                    if (lastStep) {
                        if (!queryField)
                            return;
                        apply(accessKeys, actualPath, queryField.query, key, null, data[key]);
                    }
                    else {
                        const data2 = data[key];
                        if (!data2)
                            return;
                        const actualPath2 = fork ? [...actualPath] : actualPath;
                        const accessKeys2 = fork ? [...accessKeys] : accessKeys;
                        actualPath2.push(key);
                        accessKeys2.push(key);
                        trace(i + 1, actualPath2, accessKeys2, queryField.query, data2);
                    }
                }
            }
        };
        const apply = (accessKeys, actualPath, query, column, idx, target) => {
            if (action === 'create') {
                const obj = this._slicePatch(patchData, query);
                if (column) {
                    this.data = updator.add(this.data, accessKeys, actualPath, column, obj);
                }
                else if (!target) {
                    const ordering = Object.assign({}, patch.ordering);
                    const limitOverride = request.params && request.params.limit;
                    ordering.order = request.params && request.params.order || ordering.order;
                    if (ordering.limit == null || limitOverride != null && limitOverride < ordering.limit)
                        ordering.limit = limitOverride;
                    this.data = updator.add(this.data, accessKeys, actualPath, data.length, obj, ordering);
                }
                return;
            }
            if (action === 'destroy') {
                if (column) {
                    this.data = updator.remove(this.data, accessKeys, actualPath, column);
                }
                else if (idx != null) {
                    this.data = updator.remove(this.data, accessKeys, actualPath, idx);
                }
                return;
            }
            if (!target)
                return;
            if (column) {
                actualPath.push(column);
                accessKeys.push(column);
            }
            else if (idx != null && patchData.id) {
                actualPath.push(patchData.id);
                accessKeys.push(idx);
            }
            if (action === 'update') {
                this._applyPatch(target, accessKeys, actualPath, updator, query, patchData);
            }
            else {
                const eventData = { target, path: actualPath, data: patchData.data };
                events.push({ type: patchData.type, data: eventData });
            }
        };
        if (path.length === 0) {
            apply([], [], request.query, null, null, data);
        }
        else {
            trace(0, [], [], request.query, data);
        }
    }
}
exports.default = ArSyncStore;
