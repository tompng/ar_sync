import ArSyncModel from './generated_typed_files/ArSyncModel'
import { useArSyncModel, useArSyncFetch } from './generated_typed_files/hooks'

type IsEqual<T, U> = [T, U] extends [U, T] ? true : false
function isOK<T extends true>(): T | undefined { return }
type IsStrictMode = string | null extends string ? false : true
isOK<IsStrictMode>()

const [hooksData1] = useArSyncModel({ field: 'currentUser', query: 'id' })
isOK<IsEqual<typeof hooksData1, { id: number } | null>>()
const [hooksData2] = useArSyncModel({ field: 'currentUser', query: { '*': true, foo: true } })
isOK<IsEqual<typeof hooksData2, { error: { extraFields: 'foo' } } | null>>()
const [hooksData3] = useArSyncFetch({ field: 'currentUser', query: 'id' })
isOK<IsEqual<typeof hooksData3, { id: number } | null>>()
const [hooksData4] = useArSyncFetch({ field: 'currentUser', query: { '*': true, foo: true } })
isOK<IsEqual<typeof hooksData4, { error: { extraFields: 'foo' } } | null>>()

const data1 = new ArSyncModel({ field: 'currentUser', query: 'id' }).data!
isOK<IsEqual<typeof data1, { id: number }>>()
const data2 = new ArSyncModel({ field: 'currentUser', query: ['id', 'name'] }).data!
isOK<IsEqual<typeof data2, { id: number; name: string | null }>>()
const data3 = new ArSyncModel({ field: 'currentUser', query: '*' }).data!
isOK<IsEqual<typeof data3, { id: number; name: string | null; posts: {}[]; do_not_call_after_destroyed: any }>>()
const data4 = new ArSyncModel({ field: 'currentUser',  query: { posts: 'id' } }).data!
isOK<IsEqual<typeof data4, { posts: { id: number }[] }>>()
const data5 = new ArSyncModel({ field: 'currentUser', query: { posts: '*' } }).data!
isOK<IsEqual<typeof data5, {
  posts: {
    id: number; user: {}; title: string | null; body: string | null;
    do_not_call_after_destroyed: any; comments: {}[]; my_comments: {}[]
  }[]
}>>()
const data6 = new ArSyncModel({ field: 'currentUser', query: { posts: { '*': true, comments: 'user' } } }).data!.posts[0].comments[0]
isOK<IsEqual<typeof data6, { user: {} }>>()
const data7 = new ArSyncModel({ field: 'currentUser', query: { name: true, poosts: true } }).data!
isOK<IsEqual<typeof data7, { error: { extraFields: 'poosts' } }>>()
const data8 = new ArSyncModel({ field: 'currentUser', query: { posts: { id: true, commmments: true, titllle: true } } }).data!
isOK<IsEqual<typeof data8, { error: { extraFields: 'commmments' | 'titllle' } }>>()
const data9 = new ArSyncModel({ field: 'currentUser', query: { '*': true, posts: { id: true, commmments: true } } }).data!
isOK<IsEqual<typeof data9, { error: { extraFields: 'commmments' } }>>()
const data10 = new ArSyncModel({ field: 'users', query: { '*': true, posts: { id: true, comments: '*' } } }).data![0].posts[0].comments[0].id
isOK<IsEqual<typeof data10, number>>()
const data11 = new ArSyncModel({ field: 'users', query: { '*': true, posts: { id: true, comments: '*', commmments: true } } }).data!
isOK<IsEqual<typeof data11, { error: { extraFields: 'commmments' } }>>()
const data12 = new ArSyncModel({ field: 'currentUser', query: { posts: { params: { limit: 4 }, query: 'title' } } }).data!.posts[0]
isOK<IsEqual<typeof data12, { title: string | null }>>()
const data13 = new ArSyncModel({ field: 'currentUser', query: { posts: { params: { limit: 4 }, query: ['id', 'title'] } } }).data!.posts[0]
isOK<IsEqual<typeof data13, { id: number; title: string | null }>>()
const data14 = new ArSyncModel({ field: 'currentUser', query: { posts: { params: { limit: 4 }, query: { id: true, title: true } } } }).data!.posts[0]
isOK<IsEqual<typeof data14, { id: number; title: string | null }>>()
const data15 = new ArSyncModel({ field: 'currentUser', query: { posts: ['id', 'title'] } } as const).data!.posts[0]
isOK<IsEqual<typeof data15, { id: number; title: string | null }>>()

const data16 = new ArSyncModel({ field: 'currentUser', query: { id: { field: 'name' }, name: { field: 'id' }, id2: { field: 'id' }, name2: { field: 'name' } } }).data!
isOK<IsEqual<typeof data16, { id: string | null; name: number; id2: number; name2: string | null }>>()
const data17 = new ArSyncModel({ field: 'currentUser', query: { posts: { '*': true, hoge: { field: 'comments', query: 'id' }, comments: { field: 'title' } } } }).data!.posts[0]
isOK<IsEqual<typeof data17.hoge, { id: number }[]>>()
isOK<IsEqual<typeof data17.comments, string | null>>()
