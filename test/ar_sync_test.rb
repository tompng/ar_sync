database_name = 'test/test.sqlite3'
ENV['DATABASE_NAME'] = database_name
File.unlink database_name if File.exist? database_name

require_relative 'seed'
$patches = []
ARSync.on_update do |key:, action:, path:, data:|
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
  query = [name: { as: '名前' }, posts: [:user, :title, as: :articles, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]]
  collection_query = [:user, :title, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]
  jsvar :query, query
  jsvar :cquery, collection_query
  jsvar :initial, ARSync.sync_api(User.first, User.first, *query)
  jsvar :cinitial, ARSync.sync_collection_api(Post, :last10, User.first, *collection_query)
  newpost = User.first.posts.create title: 'newposttitle', body: 'newpostbody', user: User.all.sample
  newcomment1 = User.first.posts.first.comments.create body: 'newcomment1', user: User.all.sample
  newcomment2 = User.first.posts.last.comments.create body: 'newcomment2', user: User.first
  newpost.update title: 'newposttitle2'
  jspatch :patches1
  jsvar :data1, ARSync.sync_api(User.first, User.first, *query)[:data]
  jsvar :cdata1, ARSync.sync_collection_api(Post, :last10, User.first, *collection_query)[:data]

  star1 = newcomment1.stars.create user: User.last
  star2 = newcomment2.stars.create user: User.first
  jspatch :patches2
  jsvar :data2, ARSync.sync_api(User.first, User.first, *query)[:data]
  jsvar :cdata2, ARSync.sync_collection_api(Post, :last10, User.first, *collection_query)[:data]
  star1.destroy
  star2.destroy
  newpost.destroy
  User.first.posts.create title: 'newposttitle2', body: 'newpostbody2', user: User.all.sample
  jspatch :patches3
  jsvar :data3, ARSync.sync_api(User.first, User.first, *query)[:data]
  jsvar :cdata3, ARSync.sync_collection_api(Post, :last10, User.first, *collection_query)[:data]
rescue => e
  $error = e
ensure
  [star1, star2, newcomment1, newcomment2, newpost].each do |model|
    model.destroy rescue nil
  end
  raise $error if $error
  File.write 'test/generated_test.js', <<~CODE
    const { ARSyncStore } = require('../index.js')
    #{$jscode.join("\n")}
    function compare(a, b, path, key){
      if (!path) path = []
      if (key) (path = [].concat(path)).push(key)
      function withmessage(val){
        if (!val) console.log(`${path.join('/')}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)
        return val
      }
      if (a === b) return true
      if (!a || !b) return withmessage(false)
      if (a.constructor !== b.constructor) return withmessage(false)
      if (a.constructor === Array) {
        const len = Math.max(a.length, b.length)
        for (let i=0; i<len; i++) {
          if (i >= a.length || i >= b.length) {
            console.log(`${path} at index ${i}: ${JSON.stringify(a[i])} != ${JSON.stringify(b[i])})}`)
            return false
          }
          if (!compare(a[i], b[i], path, i)) return false
        }
      } else if (a.constructor === Object) {
        const akeys = Object.keys(a).sort()
        const bkeys = Object.keys(b).sort()
        if (akeys.join('') != bkeys.join('')) {
          console.log(`${path} keys: ${JSON.stringify(akeys)} != ${JSON.stringify(bkeys)}`)
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
    function dup(obj) { return JSON.parse(JSON.stringify(obj)) }
    function selectPatch(patches) {
      return dup(patches).filter(arr => initial.keys.indexOf(arr.key) >= 0)
    }
    function selectCPatch(patches) {
      return dup(patches).filter(arr => cinitial.keys.indexOf(arr.key) >= 0)
    }
    [true, false].forEach(immutable => {
      const store = new ARSyncStore(query, dup(initial.data), { immutable })
      store.batchUpdate(selectPatch(patches1))
      console.log(compare(store.data, data1))
      store.batchUpdate(selectPatch(patches2))
      console.log(compare(store.data, data2))
      store.batchUpdate(selectPatch(patches3))
      console.log(compare(store.data, data3))

      const cstore = new ARSyncStore({collection: cquery}, dup(cinitial.data), { immutable })
      cstore.batchUpdate(selectCPatch(patches1))
      console.log(compare(cstore.data, cdata1))
      cstore.batchUpdate(selectCPatch(patches2))
      console.log(compare(cstore.data, cdata2))
      cstore.batchUpdate(selectCPatch(patches3))
      console.log(compare(cstore.data, cdata3))

    })
  CODE
  output = `node test/generated_test.js`
  puts output
  passed, errors = output.lines.partition { |s| s.strip == 'true' }
  if errors.present? || passed.empty?
    puts "\e[31mFAILED\e[m"
    exit(-1)
  else
    puts "\e[32mPASSED\e[m"
  end
end
