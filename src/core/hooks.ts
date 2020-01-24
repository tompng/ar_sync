import ArSyncAPI from './ArSyncApi'
import ArSyncModel from './ArSyncModel'

let useState: <T>(t: T | (() => T)) => [T, (t: T | ((t: T) => T)) => void]
let useEffect: (f: (() => void) | (() => (() => void)), deps: any[]) => void
let useMemo: <T>(f: () => T, deps: any[]) => T
let useRef: <T>(value: T) => { current: T }
type InitializeHooksParams = {
  useState: typeof useState
  useEffect: typeof useEffect
  useMemo: typeof useMemo
  useRef: typeof useRef
}
export function initializeHooks(hooks: InitializeHooksParams) {
  useState = hooks.useState
  useEffect = hooks.useEffect
  useMemo = hooks.useMemo
  useRef = hooks.useRef
}
function checkHooks() {
  if (!useState) throw 'uninitialized. needs `initializeHooks({ useState, useEffect, useMemo, useRef })`'
}

interface ModelStatus { complete: boolean; notfound?: boolean; connected: boolean }
export type DataAndStatus<T> = [T | null, ModelStatus]
export interface Request { api: string; params?: any; query: any }

const initialResult: DataAndStatus<any> = [null, { complete: false, notfound: undefined, connected: true }]
export function useArSyncModel<T>(request: Request | null): DataAndStatus<T> {
  checkHooks()
  const [result, setResult] = useState<DataAndStatus<T>>(initialResult)
  const requestString = JSON.stringify(request && request.params)
  const prevRequestStringRef = useRef(requestString)
  useEffect(() => {
    prevRequestStringRef.current = requestString
    if (!request) {
      setResult(initialResult)
      return () => {}
    }
    const model = new ArSyncModel<T>(request, { immutable: true })
    function update() {
      const { complete, notfound, connected, data } = model
      setResult(resultWas => {
        const [dataWas, statusWas] = resultWas
        const statusPersisted = statusWas.complete === complete && statusWas.notfound === notfound && statusWas.connected === connected
        if (dataWas === data && statusPersisted) return resultWas
        const status = statusPersisted ? statusWas : { complete, notfound, connected }
        return [data, status]
      })
    }
    if (model.complete) {
      update()
    } else {
      setResult(initialResult)
    }
    model.subscribe('load', update)
    model.subscribe('change', update)
    model.subscribe('connection', update)
    return () => model.release()
  }, [requestString])
  return prevRequestStringRef.current === requestString ? result : initialResult
}

interface FetchStatus { complete: boolean; notfound?: boolean }
type DataStatusUpdate<T> = [T | null, FetchStatus, () => void]
type FetchState<T> = { data: T | null; status: FetchStatus }
const initialFetchState: FetchState<any> = { data: null, status: { complete: false, notfound: undefined } }

function extractParams(query: unknown, output: any[] = []): any[] {
  if (typeof(query) !== 'object' || query == null || Array.isArray(query)) return output
  if ('params' in query) output.push((query as { params: any }).params)
  for (const key in query) {
    extractParams(query[key], output)
  }
  return output
}

export function useArSyncFetch<T>(request: Request | null): DataStatusUpdate<T> {
  checkHooks()
  const [state, setState] = useState<FetchState<T>>(initialFetchState)
  const query = request && request.query
  const params = request && request.params
  const requestString = useMemo(() => {
    return JSON.stringify(extractParams(query, [params]))
  }, [query, params])
  const prevRequestStringRef = useRef(requestString)
  const loader = useMemo(() => {
    let lastLoadId = 0
    let timer: null | number = null
    function cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      lastLoadId++
    }
    function fetch(request: Request, retryCount: number) {
      cancel()
      const currentLoadingId = lastLoadId
      ArSyncAPI.fetch(request).then((response: T) => {
        if (currentLoadingId !== lastLoadId) return
        setState({ data: response, status: { complete: true, notfound: false } })
      }).catch(e => {
        if (currentLoadingId !== lastLoadId) return
        if (!e.retry) {
          setState({ data: null, status: { complete: true, notfound: true } })
          return
        }
        timer = setTimeout(() => fetch(request, retryCount + 1), 1000 * Math.min(4 ** retryCount, 30))
      })
    }
    function update() {
      if (request) {
        setState(state => {
          const { data, status } = state
          if (!status.complete && status.notfound === undefined) return state
          return { data, status: { complete: false, notfound: undefined } }
        })
        fetch(request, 0)
      } else {
        setState(initialFetchState)
      }
    }
    return { update, cancel }
  }, [requestString])
  useEffect(() => {
    prevRequestStringRef.current = requestString
    setState(initialFetchState)
    loader.update()
    return () => loader.cancel()
  }, [requestString])
  const responseState = prevRequestStringRef.current === requestString ? state : initialFetchState
  return [responseState.data, responseState.status, loader.update]
}
