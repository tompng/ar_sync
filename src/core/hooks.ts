import { useState, useEffect, useMemo } from 'react'
import ArSyncAPI from './ArSyncApi'
import ArSyncModel from './ArSyncModel'

interface ModelStatus { complete: boolean; notfound?: boolean; connected: boolean }
export type DataAndStatus<T> = [T | null, ModelStatus]
export interface Request { api: string; params?: any; query: any }

const initialResult: DataAndStatus<any> = [null, { complete: false, notfound: undefined, connected: true }]
export function useArSyncModel<T>(request: Request | null): DataAndStatus<T> {
  const [result, setResult] = useState<DataAndStatus<T>>(initialResult)
  const requestString = JSON.stringify(request && request.params)
  useEffect(() => {
    if (!request) {
      setResult(initialResult)
      return () => {}
    }
    const model = new ArSyncModel<T>(request, { immutable: true })
    function update() {
      const { complete, notfound, connected, data } = model
      setResult(resultWas => {
        const [, statusWas] = resultWas
        const statusPersisted = statusWas.complete === complete && statusWas.notfound === notfound && statusWas.connected === connected
        const status = statusPersisted ? statusWas : { complete, notfound, connected }
        return [data, status]
      })
    }
    if (model.complete) {
      update()
    } else {
      setResult(initialResult)
    }
    model.subscribe('change', update)
    model.subscribe('connection', update)
    return () => model.release()
  }, [requestString])
  return result
}

interface FetchStatus { complete: boolean; notfound?: boolean }
type DataStatusUpdate<T> = [T | null, FetchStatus, () => void]
type FetchState<T> = { data: T | null; status: FetchStatus }
const initialFetchState: FetchState<any> = { data: null, status: { complete: false, notfound: undefined } }
export function useArSyncFetch<T>(request: Request | null): DataStatusUpdate<T> {
  const [state, setState] = useState<FetchState<T>>(initialFetchState)
  const requestString = JSON.stringify(request && request.params)
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
    setState(initialFetchState)
    loader.update()
    return () => loader.cancel()
  }, [requestString])
  return [state.data, state.status, loader.update]
}
