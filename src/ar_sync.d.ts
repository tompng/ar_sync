interface Request { api: string; query: any; params?: any }
type Path = (string | number)[]
interface Change { path: Path; value: any }
type ChangeCallback = (change: Change) => void
type LoadCallback = () => void
interface Adapter {
  subscribe: (key: string, received: (data: any) => void) => { unsubscribe: () => void }
  ondisconnect: () => void
  onreconnect: () => void
}
export class ArSyncModel<T> {
  constructor(request: Request, option?: { immutable: boolean })
  onload: (callback: LoadCallback) => void
  subscribeOnce: (event: 'load' | 'change', callback: LoadCallback | ChangeCallback) => void
  subscribe: (event: 'load' | 'change', callback: LoadCallback | ChangeCallback) => { unsubscribe: () => void }
  release: () => void
  dig: (path: Path, object?: any) => any
  loaded: boolean | undefined
  data: T | {} | undefined // TODO: fix the implementation. it shoud be T | null
  static setConnectionAdapter: (adapter: Adapter) => void
}
export const ArSyncAPI: {
  fetch: <T, R extends Request>(req: R) => Promise<T>
  syncFetch: <T, R extends Request>(req: R) => Promise<T>
}
