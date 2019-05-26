import ArSyncModel from './generated_typed_files/ArSyncModel'
import { useArSyncModel, useArSyncFetch } from './generated_typed_files/hooks'

const [hooksData1] = useArSyncModel({ field: 'currentUser', query: 'id' })
hooksData1!.id
const [hooksData2] = useArSyncModel({ field: 'currentUser', query: { '*': true, foo: true } })
hooksData2!.error.extraFields = 'foo'
const [hooksData3] = useArSyncFetch({ field: 'currentUser', query: 'id' })
hooksData3!.id
const [hooksData4] = useArSyncFetch({ field: 'currentUser', query: { '*': true, foo: true } })
hooksData4!.error.extraFields = 'foo'

const data1 = new ArSyncModel({ field: 'currentUser', query: 'id' }).data!
data1.id
const data2 = new ArSyncModel({ field: 'currentUser', query: ['id', 'name'] }).data!
data2.id; data2.name
const data3 = new ArSyncModel({ field: 'currentUser', query: '*' }).data!
data3.id; data3.name; data3.posts
const data4 = new ArSyncModel({ field: 'currentUser',  query: { posts: 'id' } }).data!
data4.posts[0].id
const data5 = new ArSyncModel({ field: 'currentUser', query: { posts: '*' } }).data!
data5.posts[0].id; data5.posts[0].user; data5.posts[0].body
const data6 = new ArSyncModel({ field: 'currentUser', query: { posts: { '*': true, comments: 'user' } } }).data!
data6.posts[0].id; data6.posts[0].user; data6.posts[0].comments[0].user
const data7 = new ArSyncModel({ field: 'currentUser', query: { name: true, poosts: true } }).data!
data7.error.extraFields = 'poosts'
const data8 = new ArSyncModel({ field: 'currentUser', query: { posts: { id: true, commmments: true, titllle: true } } }).data!
data8.error.extraFields = 'commmments'
data8.error.extraFields = 'titllle'
const data9 = new ArSyncModel({ field: 'currentUser', query: { '*': true, posts: { id: true, commmments: true } } }).data!
data9.error.extraFields = 'commmments'
const data10 = new ArSyncModel({ field: 'users', query: { '*': true, posts: { id: true, comments: '*' } } }).data!
data10[0].posts[0].comments[0].id
const data11 = new ArSyncModel({ field: 'users', query: { '*': true, posts: { id: true, comments: '*', commmments: true } } }).data!
data11.error.extraFields = 'commmments'
const data12 = new ArSyncModel({ field: 'currentUser', query: { posts: { params: { limit: 4 }, query: 'title' } } }).data!
data12.posts[0].title
const data13 = new ArSyncModel({ field: 'currentUser', query: { posts: { params: { limit: 4 }, query: ['id', 'title'] } } }).data!
data13.posts[0].title
const data14 = new ArSyncModel({ field: 'currentUser', query: { posts: { params: { limit: 4 }, query: { id: true, title: true } } } }).data!
data14.posts[0].title
const data15 = new ArSyncModel({ field: 'currentUser', query: { posts: ['id', 'title'] } } as const).data!
data15.posts[0].title

const data16 = new ArSyncModel({ field: 'currentUser', query: { id: { field: 'name' }, name: { field: 'id' }, id2: { field: 'id' }, name2: { field: 'name' } } }).data!
data16.name = data16.id2 = 0
data16.id = data16.name2 = 'name'
const data17 = new ArSyncModel({ field: 'currentUser', query: { posts: { '*': true, hoge: { field: 'comments', query: 'id' }, comments: { field: 'title' } } } }).data!
data17.posts[0].comments = 'title'
data17.posts[0].hoge[0].id = 0
