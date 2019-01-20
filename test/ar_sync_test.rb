database_name = 'test/test.sqlite3'
ENV['DATABASE_NAME'] = database_name
File.unlink database_name if File.exist? database_name
require_relative 'seed'
$patches = []
ArSync.on_notification do |events|
  events.each do |key, patch|
    $patches << { key: key, **patch }
  end
end

query = [name: { as: '名前' }, posts: [:user, :title, as: :articles, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]]
post_query = [:user, :title, comments: [:body, as: :cmnts]]
collection_query = [:user, :title, my_comments: [:star_count, as: :my_opinions], comments: [:star_count, :user, my_stars: :id, my_star: { as: :my_reaction }]]

$test_cases = {
  user: [Tree::User.first, query],
  post: [Tree::User.first.posts.first, post_query],
  post_collection: [Tree::Post.sync_collection(:last10), collection_query]
}
def api(target, query)
  if target.is_a? ActiveRecord::Base
    ArSync.sync_api target.reload, Tree::User.first, query
  else
    ArSync.sync_collection_api target, Tree::User.first, query
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

newpost = Tree::User.first.posts.create title: 'newposttitle', body: 'newpostbody', user: Tree::User.all.sample
Tree::User.first.posts.first.update title: 'title2'
newcomment1 = Tree::User.first.posts.first.comments.create body: 'newcomment1', user: Tree::User.all.sample
newcomment2 = Tree::User.first.posts.last.comments.create body: 'newcomment2', user: Tree::User.first
newpost.update title: 'newposttitle2'

step_test!

star1 = newcomment1.stars.create user: Tree::User.last
star2 = newcomment2.stars.create user: Tree::User.first

step_test!

star1.destroy
star2.destroy
newpost.destroy
Tree::User.first.posts.create title: 'newposttitle2', body: 'newpostbody2', user: Tree::User.all.sample

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
