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
  query = [name: { as: '名前' }, posts: [:user, :title, as: :articles, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]]
  jsvar :query, query
  jsvar :initial, ARSync.sync_api(User.first, User.first, *query)
  newpost = User.first.posts.create title: 'newposttitle', body: 'newpostbody', user: User.all.sample
  newcomment1 = User.first.posts.first.comments.create body: 'newcomment1', user: User.all.sample
  newcomment2 = User.first.posts.last.comments.create body: 'newcomment2', user: User.first
  newpost.update title: 'newposttitle2'
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
    const { ARSyncStore, NormalUpdator, ImmutableUpdator } = require('../ar_sync.js')
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
    [null, NormalUpdator, ImmutableUpdator].forEach(klass => {
      const store = new ARSyncStore(initial.keys, query, dup(initial.data), klass)
      store.batchUpdate(dup(patches1))
      console.log(compare(store.data, data1))
      store.batchUpdate(dup(patches2))
      console.log(compare(store.data, data2))
      store.batchUpdate(dup(patches3))
      console.log(compare(store.data, data3))
    })
  CODE
  output = `node generated_test.js`
  puts output
  errors = output.lines.reject{|s|s.strip=='true'}
  if errors.present?
    puts "\e[31mFAILED\e[m"
    exit -1
  else
    puts "\e[32mPASSED\e[m"
  end
end
