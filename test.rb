require_relative 'model'
$patches = []
ARSync.configure do |key:, action:, path:, data:|
  $patches << { key: key, action: action, path: path, data: data }
end

begin
  $jscode = []
  def jsvar name, data
    $jscode << "const #{name} = #{data.to_json}"
  end
  def jspatch name
    jsvar name, $patches
    $patches = []
  end
  query = [:name, posts: [:id, :user, :title, comments: [:id, :star_count, :user, my_stars: :id]]]
  jsvar :query, query
  jsvar :initial, ARSync.sync_api(User.first, User.first, *query)
  newpost = User.first.posts.create title: 'newposttitle', body: 'newpostbody', user: User.all.sample
  newcomment1 = User.first.posts.first.comments.create body: 'newcomment1', user: User.all.sample
  newcomment2 = User.first.posts.last.comments.create body: 'newcomment2', user: User.all.sample
  jspatch :patches1
  jsvar :data1, ARSync.sync_api(User.first, User.first, *query)[:data]

  star1 = newcomment1.stars.create user: User.last
  star2 = newcomment2.stars.create user: User.first
  jspatch :patches2
  jsvar :data2, ARSync.sync_api(User.first, User.first, *query)[:data]
  star1.destroy
  star2.destroy
  jspatch :patches3
  jsvar :data3, ARSync.sync_api(User.first, User.first, *query)[:data]
ensure
  [star1, star2, newcomment1, newcomment2, newpost].each do |model|
    model.destroy rescue nil
  end
  File.write 'generated_test.js', <<~CODE
    const ARSyncStore = require('./arsync.js')
    #{$jscode.join("\n")}
    const store = new ARSyncStore(initial.keys, query, initial.data)
    function applyPatches(patches){
      patches.forEach((patch)=>{
        if (initial.keys.indexOf(patch.key) === -1) return
        store.update(patch.action, patch.path, patch.data)
      })
    }
    function compare(a, b, path, key){
      if (!path) path = []
      if (key) (path = [].concat(path)).push(key)
      function withmessage(val){
        if (!val) console.error(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)
        return val
      }
      if (a.constructor !== b.constructor) return withmessage(false)
      if (a.constructor === Array) {
        const len = Math.max(a.length, b.length)
        for (let i=0; i<len; i++) {
          if (i >= a.length || i >= b.length) {
            console.error(`${path} at index ${i}: ${JSON.stringify(a[i])} != ${JSON.stringify(b[i])})}`)
            return false
          }
          if (!compare(a[i], b[i], path, i)) return false
        }
      } else if (a.constructor === Object) {
        const akeys = Object.keys(a).sort()
        const bkeys = Object.keys(b).sort()
        if (akeys.join('') != bkeys.join('')) {
          console.error(`${path} keys: ${JSON.stringify(akeys)} != ${JSON.stringify(bkeys)}`)
          return false
        }
        for (const i in a) {
          if (!compare(a[i], b[i], path, i)) return false
        }
      } else {
        return withmessage(a === b)
      }
      return true
    }
    applyPatches(patches1)
    console.error(compare(store.data, data1))
    applyPatches(patches2)
    console.error(compare(store.data, data2))
    applyPatches(patches3)
    console.error(compare(store.data, data3))
  CODE
  `node generated_test.js`
end
