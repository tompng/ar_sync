import { useState, useEffect, useCallback } from 'react'
import ArSyncAPI from './ArSyncApi'

interface ModelStatus { complete: boolean; notfound?: boolean; connected: boolean }
export type DataAndStatus<T> = [T | null, ModelStatus]
export interface Request { field: string; params?: any; query?: any }

interface ArSyncModel<T> {
  data: T | null
  complete: boolean
  connected: boolean
  notfound?: boolean
  release(): void
  subscribe(type: any, callback: any): any
}
export function useArSyncModelWithClass<T>(modelClass: { new<T>(req: Request, option?: any): ArSyncModel<T> }, request: Request | null): DataAndStatus<T> {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<ModelStatus>({ complete: false, connected: true })
  const updateStatus = (complete: boolean, notfound: boolean | undefined, connected: boolean) => {
    if (complete === status.complete || notfound === status.notfound || connected === status.notfound) return
    setStatus({ complete, notfound, connected })
  }
  useEffect(() => {
    if (!request) return () => {}
    const model = new modelClass<T>(request, { immutable: true })
    if (model.complete) setData(model.data)
    updateStatus(model.complete, model.notfound, model.connected)
    model.subscribe('change', () => {
      updateStatus(model.complete, model.notfound, model.connected)
      setData(model.data)
    })
    model.subscribe('connection', () => {
      updateStatus(model.complete, model.notfound, model.connected)
    })
    return () => model.release()
  }, [JSON.stringify(request && request.params)])
  return [data, status]
}


interface FetchStatus { complete: boolean; notfound?: boolean }
type DataAndStatusAndUpdater<T> = [T | null, FetchStatus, () => void]
export function useArSyncFetch<T>(request: Request | null): DataAndStatusAndUpdater<T> {
  const [response, setResponse] = useState<T | null>(null)
  const [status, setStatus] = useState<FetchStatus>({ complete: false })
  const requestString = JSON.stringify(request && request.params)
  let canceled = false
  let timer: number | null = null
  const update = useCallback(() => {
    if (!request) {
      setStatus({ complete: false, notfound: undefined })
      return () => {}
    }
    canceled = false
    timer = null
    const fetch = (count: number) => {
      if (timer) clearTimeout(timer)
      timer = null
      ArSyncAPI.fetch(request)
        .then((response) => {
          if (canceled) return
          setResponse(response as T)
          setStatus({ complete: true, notfound: false })
        })
        .catch(e => {
          if (canceled) return
          if (!e.retry) {
            setResponse(null)
            setStatus({ complete: true, notfound: true })
            return
          }
          timer = setTimeout(() => fetch(count + 1), 1000 * Math.min(4 ** count, 30))
        })
    }
    fetch(0)
  }, [requestString])
  useEffect(() => {
    update()
    return () => {
      canceled = true
      if (timer) clearTimeout(timer)
      timer = null
    }
  }, [requestString])
  return [response, status, update]
}
