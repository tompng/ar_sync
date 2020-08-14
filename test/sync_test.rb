database_name = 'test/test.sqlite3'
ENV['DATABASE_NAME'] = database_name
File.unlink database_name if File.exist? database_name
require_relative 'seed'
require_relative 'helper/test_runner'
require_relative 'model'

class Schema
  include ArSerializer::Serializable
  serializer_field(:currentUser) { |user| user }
  serializer_field(:post) { |_user, id:| Post.find id }
  serializer_field(:comment) { |_user, id:| Post.find id }

  [User, Post, Comment, Star].each do |klass|
    serializer_field(klass.name) { |_user, ids:| klass.where id: ids }
  end
end

user = User.second
runner = TestRunner.new Schema.new, user

# _sync_xxx_before_mutation can be nil
post = Post.last
post.update title: post.title + '!'
post.save

runner.eval_script <<~JAVASCRIPT
  global.userModel = new ArSyncModel({
    api: 'currentUser',
    query: {
      name: { as: '名前' },
      posts: {
        as: 'articles',
        attributes: {
          user: ['id', 'name'],
          title: true,
          myComments: { as: 'myCmnts', attributes: ['id', 'starCount'] },
          comments: {
            starCount: true,
            user: ['id', 'name'],
            myStar: { as: 'myReaction', attributes: 'id' }
          }
        }
      }
    }
  })
JAVASCRIPT

users = User.all.to_a

tap do # load test
  runner.assert_script 'userModel.data'
  runner.assert_script 'userModel.data.articles.length > 0'
end

tap do # field udpate test
  post = user.posts.first
  name = "Name#{rand}"
  user.update name: name
  runner.assert_script 'userModel.data.名前', to_be: name
  runner.assert_script 'userModel.data.articles[0].user.name', to_be: name
  title = "Title#{rand}"
  post.update title: title
  runner.assert_script 'userModel.data.articles[0].title', to_be: title
end

tap do # has_many update & destroy
  title = "NewPost#{rand}"
  new_post = user.posts.create user: users.sample, title: title
  runner.assert_script 'userModel.data.articles.map(a => a.title)', to_include: title
  new_comment = new_post.comments.create user: users.sample
  idx = user.posts.size - 1
  runner.assert_script "userModel.data.articles[#{idx}].comments.map(c => c.id)", to_include: new_comment.id
  new_comment.destroy
  runner.assert_script "userModel.data.articles[#{idx}].comments.map(c => c.id)", not_to_include: new_comment.id
  new_post.destroy
  runner.assert_script 'userModel.data.articles.map(a => a.title)', not_to_include: title
end

tap do # has_one change
  comment = user.posts.first.comments.first
  runner.assert_script 'userModel.data.articles[0].comments[0].user.name', to_be: comment.user.name
  comment.update user: nil
  runner.assert_script 'userModel.data.articles[0].comments[0].user', to_be: nil
  comment.update user: users.second
  runner.assert_script 'userModel.data.articles[0].comments[0].user'
  runner.assert_script 'userModel.data.articles[0].comments[0].user.id', to_be: users.second.id
  comment.update user: users.third
  runner.assert_script 'userModel.data.articles[0].comments[0].user.id', to_be: users.third.id
end

tap do # parent replace
  comment = user.posts.first.comments.first
  runner.assert_script 'userModel.data.articles[0].comments[0].id', to_be: comment.id
  comment.update post: user.posts.second
  runner.assert_script 'userModel.data.articles[0].comments[0].id', not_to_be: comment.id
  runner.assert_script 'userModel.data.articles[1].comments.map(c => c.id)', to_include: comment.id
end

tap do # per-user has_many
  post = user.posts.first
  other_user = (users - [user]).sample
  comment_other = post.comments.create user: other_user, body: rand.to_s
  comment_self = post.comments.create user: user, body: rand.to_s
  all_comments_code = 'userModel.data.articles[0].comments.map(c => c.id)'
  my_comments_code = 'userModel.data.articles[0].myCmnts.map(c => c.id)'
  runner.assert_script all_comments_code, to_include: comment_other.id
  runner.assert_script all_comments_code, to_include: comment_self.id
  runner.assert_script my_comments_code, not_to_include: comment_other.id
  runner.assert_script my_comments_code, to_include: comment_self.id
  comment_other.update user: user
  runner.assert_script my_comments_code, to_include: comment_other.id
  runner.assert_script my_comments_code, to_include: comment_self.id
  comment_self.update user: other_user
  runner.assert_script my_comments_code, to_include: comment_other.id
  runner.assert_script my_comments_code, not_to_include: comment_self.id
  post.comments.reload
end

tap do # per-user has_one
  comment = user.posts.first.comments.first
  other_user = (users - [user]).sample
  comment_code = 'userModel.data.articles[0].comments[0]'
  comment.stars.where(user: user).first_or_create
  runner.assert_script "#{comment_code}.myReaction"
  comment.stars.find_by(user: user).destroy
  runner.assert_script "#{comment_code}.myReaction", to_be: nil
  comment.stars.find_by(user: other_user)&.destroy
  comment.stars.create(user: other_user)
  runner.assert_script "#{comment_code}.starCount", to_be: comment.stars.count
  runner.assert_script "#{comment_code}.myReaction", to_be: nil
  star = comment.stars.create(user: user)
  runner.assert_script "#{comment_code}.starCount", to_be: comment.stars.count
  runner.assert_script "#{comment_code}.myReaction"
  runner.assert_script "#{comment_code}.myReaction.id", to_be: star.id
end

tap do # order test
  post = Post.first
  post.comments.each do |c|
    c.update body: rand.to_s
  end
  10.times do
    post.comments.create user: users.sample, body: rand.to_s
  end
  runner.eval_script <<~JAVASCRIPT
    global.postModel = new ArSyncModel({
      api: 'post',
      params: { id: #{post.id} },
      query: {
        comments: {
          params: { order: { body: 'desc' } },
          attributes: { id: true, body: { as: 'text' } }
        }
      }
    })
  JAVASCRIPT
  runner.assert_script 'postModel.data'
  comments_code = 'postModel.data.comments.map(c => c.id)'
  current_order = -> { post.comments.reload.sort_by(&:body).reverse.map(&:id) }
  runner.assert_script comments_code, to_be: current_order.call
  post.comments.create user: users.sample, body: '0.6'
  runner.assert_script comments_code, to_be: current_order.call
  post.comments.sort_by(&:body).first.update body: '0.4'
  runner.assert_script comments_code, to_be: current_order.call
  comments_body_code = 'postModel.data.comments.map(c => c.text)'
  runner.assert_script comments_body_code, to_include: '0.4'
  runner.assert_script comments_body_code, to_include: '0.6'
  runner.eval_script 'postModel.release(); postModel = null'
end

tap do # no subquery test
  runner.eval_script <<~JAVASCRIPT
    global.noSubqueryTestModel = new ArSyncModel({
      api: 'currentUser',
      query: ['id', 'posts']
    })
  JAVASCRIPT
  runner.assert_script 'noSubqueryTestModel.data'
  runner.assert_script 'noSubqueryTestModel.data.posts[0].id >= 1'
end

tap do # object field test
  runner.eval_script <<~JAVASCRIPT
    global.objectFieldTestModel = new ArSyncModel({
      api: 'currentUser',
      query: ['itemWithId', 'itemsWithId']
    })
  JAVASCRIPT
  runner.assert_script 'objectFieldTestModel.data'
  runner.assert_script 'objectFieldTestModel.data.itemWithId', to_be: { 'id' => 1, 'value' => 'data' }
  runner.assert_script 'objectFieldTestModel.data.itemsWithId', to_be: [{ 'id' => 1, 'value' => 'data' }]
end

tap do # wildcard update test
  runner.eval_script <<~JAVASCRIPT
    global.wildCardTestModel = new ArSyncModel({
      api: 'currentUser',
      query: { posts: '*' }
    })
  JAVASCRIPT
  runner.assert_script 'wildCardTestModel.data'
  title = "Title#{rand}"
  user.posts.reload.second.update title: title
  runner.assert_script 'wildCardTestModel.data.posts[1].title', to_be: title
  runner.eval_script 'wildCardTestModel.release(); wildCardTestModel = null'
end

tap do # plain-array filed test
  post1 = Post.first
  post2 = Post.second
  post1.update title: ''
  post2.update title: 'abc'
  [post1, post2].each do |post|
    runner.eval_script <<~JAVASCRIPT
      global.postModel = new ArSyncModel({
        api: 'post',
        params: { id: #{post.id} },
        query: ['id','titleChars']
      })
    JAVASCRIPT
    runner.assert_script 'postModel.data'
    runner.assert_script 'postModel.data.titleChars', to_be: post.title.chars
    chars = rand.to_s.chars
    post.update title: chars.join
    runner.assert_script 'postModel.data.titleChars', to_be: chars
  end
end

tap do # watch test
  comment = Comment.first
  post = comment.post
  star = comment.stars.create user: User.first
  count = comment.stars.where('created_at != updated_at').count
  runner.eval_script <<~JAVASCRIPT
    global.postModel = new ArSyncModel({
      api: 'post',
      params: { id: #{post.id} },
      query: { comments: 'editedStarCount' }
    })
  JAVASCRIPT
  runner.assert_script 'postModel.data'
  runner.assert_script 'postModel.data.comments[0].editedStarCount', to_be: count
  star.update updated_at: 1.day.since
  runner.assert_script 'postModel.data.comments[0].editedStarCount', to_be: count + 1
  star.update updated_at: star.created_at
  runner.assert_script 'postModel.data.comments[0].editedStarCount', to_be: count
end

tap do # root array field test
  post1 = Post.first
  post2 = Post.second
  runner.eval_script <<~JAVASCRIPT
    global.postsModel = new ArSyncModel({
      api: 'Post',
      params: { ids: [#{post1.id}, #{post2.id}] },
      query: ['id', 'title']
    })
  JAVASCRIPT
  runner.assert_script 'postsModel.data'
  runner.assert_script 'postsModel.data[0].title', to_be: post1.title
  title2 = "title#{rand}"
  post1.update title: title2
  runner.assert_script 'postsModel.data[0].title', to_be: title2
end

tap do # model load from id
  post1 = Post.first
  post2 = Post.second
  runner.eval_script <<~JAVASCRIPT
    global.p1 = new ArSyncModel({ api: 'Post', id: #{post1.id}, query: 'title' })
    global.p2 = new ArSyncModel({ api: 'Post', id: #{post2.id}, query: 'title' })
  JAVASCRIPT
  runner.assert_script 'p1.data && p2.data'
  runner.assert_script '[p1.data.title, p2.data.title]', to_be: [post1.title, post2.title]
  p1title = "P1#{rand}"
  post1.update title: p1title
  runner.assert_script '[p1.data.title, p2.data.title]', to_be: [p1title, post2.title]
  p2title = "P2#{rand}"
  post2.update title: p2title
  runner.assert_script '[p1.data.title, p2.data.title]', to_be: [p1title, p2title]
end

tap do # sync self
  star = YellowStar.first
  runner.eval_script <<~JAVASCRIPT
    global.star = new ArSyncModel({ api: 'Star', id: #{star.id}, query: 'type' })
  JAVASCRIPT
  runner.assert_script 'star.data'
  runner.assert_script '[star.data.type]', to_be: ['YellowStar']
  star.update!(type: 'RedStar')
  runner.assert_script '[star.data.type]', to_be: ['RedStar']
end
