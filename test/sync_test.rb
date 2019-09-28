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

current_user = Graph::User.second
runner = TestRunner.new Schema.new, current_user

runner.eval_script <<~JAVASCRIPT
  global.currentUserModel = new ArSyncModel({
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

require 'pry'
binding.pry
