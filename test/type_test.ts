import ArSyncModel from './generated_typed_files/ArSyncModel'
import { useArSyncModel, useArSyncFetch } from './generated_typed_files/hooks'
import ActionCableAdapter from '../src/core/ActionCableAdapter'
import * as ActionCable from 'actioncable'
ArSyncModel.setConnectionAdapter(new ActionCableAdapter(ActionCable))

type IsEqual<T, U> = [T, U] extends [U, T] ? true : false
function isOK<T extends true>(): T | undefined { return }
type IsStrictMode = string | null extends string ? false : true
type TypeIncludes<T extends {}, U extends {}> = IsEqual<Pick<T, keyof T & keyof U>, U>
type HasExtraField<T extends { error: { extraFields: any } } | null, U> = IsEqual<Exclude<T, null>['error']['extraFields'], U>
isOK<IsStrictMode>()

const [hooksData1] = useArSyncModel({ api: 'currentUser', query: 'id' })
isOK<IsEqual<typeof hooksData1, { id: number } | null>>()
const [hooksData2] = useArSyncModel({ api: 'currentUser', query: { '*': true, foo: true } })
isOK<HasExtraField<typeof hooksData2, 'foo'>>()
const [hooksData3] = useArSyncFetch({ api: 'currentUser', query: 'id' })
isOK<IsEqual<typeof hooksData3, { id: number } | null>>()
const [hooksData4] = useArSyncFetch({ api: 'currentUser', query: { '*': true, foo: true } })
isOK<HasExtraField<typeof hooksData4, 'foo'>>()

const data1 = new ArSyncModel({ api: 'currentUser', query: 'id' }).data!
isOK<IsEqual<typeof data1, { id: number }>>()
const data2 = new ArSyncModel({ api: 'currentUser', query: ['id', 'name'] }).data!
isOK<IsEqual<typeof data2, { id: number; name: string | null }>>()
const data3 = new ArSyncModel({ api: 'currentUser', query: '*' }).data!
isOK<IsEqual<typeof data3, { id: number; name: string | null; sync_keys: string[]; posts: {}[]; postOrNull: {} | null; itemWithId: any; itemsWithId: any }>>()
const data4 = new ArSyncModel({ api: 'currentUser',  query: { posts: 'id' } }).data!
isOK<IsEqual<typeof data4, { posts: { id: number }[] }>>()
const data5 = new ArSyncModel({ api: 'currentUser', query: { posts: '*' } }).data!
data5.posts[0].id; data5.posts[0].user; data5.posts[0].body
isOK<TypeIncludes<typeof data5.posts[0], { body: string | null, comments: {}[] }>>()
const data6 = new ArSyncModel({ api: 'currentUser', query: { posts: { '*': true, comments: 'user' } } }).data!
isOK<TypeIncludes<typeof data6.posts[0], { user: {}, comments: { user: {} }[] }>>()
const data7 = new ArSyncModel({ api: 'currentUser', query: { name: true, poosts: true } }).data!
isOK<HasExtraField<typeof data7, 'poosts'>>()
const data8 = new ArSyncModel({ api: 'currentUser', query: { posts: { id: true, commmments: true, titllle: true } } }).data!
isOK<HasExtraField<typeof data8, 'commmments' | 'titllle'>>()
const data9 = new ArSyncModel({ api: 'currentUser', query: { '*': true, posts: { id: true, commmments: true } } }).data!
isOK<HasExtraField<typeof data9, 'commmments'>>()
const data10 = new ArSyncModel({ api: 'users', query: { '*': true, posts: { id: true, comments: '*' } } }).data!
isOK<TypeIncludes<(typeof data10)[0]['posts'][0]['comments'][0], { id: number; body: string | null }>>()
const data11 = new ArSyncModel({ api: 'users', query: { '*': true, posts: { id: true, comments: '*', commmments: true } } }).data!
isOK<HasExtraField<typeof data11, 'commmments'>>()
const data12 = new ArSyncModel({ api: 'currentUser', query: { posts: { params: { first: 4 }, attributes: 'title' } } }).data!
isOK<IsEqual<(typeof data12.posts)[0], { title: string | null }>>()
const data13 = new ArSyncModel({ api: 'currentUser', query: { posts: { params: { first: 4 }, attributes: ['id', 'title'] } } }).data!
isOK<IsEqual<(typeof data13.posts)[0], { id: number; title: string | null }>>()
const data14 = new ArSyncModel({ api: 'currentUser', query: { posts: { params: { first: 4 }, attributes: { id: true, title: true } } } }).data!
isOK<IsEqual<(typeof data14.posts)[0], { id: number; title: string | null }>>()
const data15 = new ArSyncModel({ api: 'currentUser', query: { posts: ['id', 'title'] } } as const).data!
isOK<IsEqual<(typeof data15.posts)[0], { id: number; title: string | null }>>()
const data16 = new ArSyncModel({ api: 'User', id: 1, query: 'name' }).data!
isOK<IsEqual<typeof data16, { name: string | null }>>()
const data17 = new ArSyncModel({ api: 'currentUser', query: 'postOrNull' }).data!
isOK<IsEqual<typeof data17, { postOrNull: {} | null }>>()
const data18 = new ArSyncModel({ api: 'currentUser', query: { postOrNull: 'title' } }).data!
isOK<IsEqual<typeof data18, { postOrNull: { title: string | null } | null }>>()
const data19 = new ArSyncModel({ api: 'currentUser', query: { '*': true, postOrNull: 'title' } }).data!
isOK<TypeIncludes<typeof data19, { postOrNull: { title: string | null } | null }>>()

const model = new ArSyncModel({ api: 'currentUser', query: { posts: ['id', 'title'] } } as const)
let digId = model.dig(['posts', 0, 'id'] as const)
isOK<IsEqual<typeof digId, number | null | undefined>>()
let digTitle = model.dig(['posts', 0, 'title'] as const)
isOK<IsEqual<typeof digTitle, string | null | undefined>>()
