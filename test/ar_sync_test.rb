database_name = 'test/test.sqlite3'
ENV['DATABASE_NAME'] = database_name
File.unlink database_name if File.exist? database_name
require_relative 'seed'
$patches = []
ARSync.on_update do |key:, action:, path:, data:|
  $patches << { key: key, action: action, path: path, data: data }
end

query = [name: { as: '名前' }, posts: [:user, :title, as: :articles, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]]
post_query = [:user, :title, comments: [:body, as: :cmnts]]
collection_query = [:user, :title, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]

$test_cases = {
  user: [User.first, query],
  post: [User.first.posts.first, post_query],
  post_collection: [Post.sync_collection(:last10), collection_query]
}
def api(target, query)
  if target.is_a? ActiveRecord::Base
    ARSync.sync_api target.reload, User.first, *query
  else
    ARSync.sync_collection_api target, User.first, *query
  end
end

$data = {
  names: $test_cases.keys,
  queries: $test_cases.values.map(&:last),
  initials: $test_cases.values.map { |t, q| api t, q },
  tests: []
}
def step_test!
  $data[:tests] << {
    patches: $patches,
    states: $test_cases.values.map { |t, q| api(t, q)[:data] }
  }
  $patches = []
end

newpost = User.first.posts.create title: 'newposttitle', body: 'newpostbody', user: User.all.sample
User.first.posts.first.update title: 'title2'
newcomment1 = User.first.posts.first.comments.create body: 'newcomment1', user: User.all.sample
newcomment2 = User.first.posts.last.comments.create body: 'newcomment2', user: User.first
newpost.update title: 'newposttitle2'

step_test!

star1 = newcomment1.stars.create user: User.last
star2 = newcomment2.stars.create user: User.first

step_test!

star1.destroy
star2.destroy
newpost.destroy
User.first.posts.create title: 'newposttitle2', body: 'newpostbody2', user: User.all.sample

step_test!

File.write 'test/generated_test.js', "require('./test_helper.js')(#{$data.to_json})"
output = `node test/generated_test.js`
puts output
passed = output.lines.grep(/true/)
errors = output.lines.grep(/false/)
if errors.present? || passed.empty?
  puts "\e[31mFAILED\e[m"
  exit(-1)
else
  puts "\e[32mPASSED\e[m"
end
