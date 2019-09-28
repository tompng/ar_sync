database_name = 'test/test.sqlite3'
ENV['DATABASE_NAME'] = database_name
File.unlink database_name if File.exist? database_name
require_relative 'seed'
require_relative 'helper/test_runner'
require_relative 'model_graph'

class Schema
  include ArSerializer::Serializable
  serializer_field(:currentUser) { |user| user }
  serializer_field(:post) { |_user, id:| Post.find id }
  serializer_field(:comment) { |_user, id:| Post.find id }

  [Graph::User, Graph::Post, Graph::Comment, Graph::Star].each do |klass|
    serializer_field(klass.name) { |_user, ids:| klass.find ids }
  end
end

user = Graph::User.second
runner = TestRunner.new Schema.new, user

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
          myComments: { as: 'myComments', attributes: ['id', 'starCount'] },
          comments: {
            starCount: true,
            user: ['id', 'name'],
            myStars: { as: 'myReaction', attributes: 'id' }
          }
        }
      }
    }
  })
JAVASCRIPT

users = Graph::User.all.to_a

runner.assert_script 'userModel.data'
runner.assert_script 'userModel.data.articles.length', to_be: user.posts.size
post = user.posts.first
post.update title: "Title#{rand}"
runner.assert_script 'userModel.data.articles[0].title', to_be: post.title
new_post = user.posts.create user: users.sample, title: "NewPost#{rand}"
runner.assert_script('userModel.data.articles.map(a => a.title)') { |r| r.include? new_post.title }
new_post.destroy;runner.assert_script('userModel.data.articles.map(a => a.title)') { |r| !r.include? new_post.title }
