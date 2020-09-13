require 'activerecord-import'
require_relative 'db'
require_relative 'model'
database_file = ActiveRecord::Base.connection.instance_eval { @config[:database] }
File.unlink database_file if File.exist? database_file
ActiveRecord::Base.clear_all_connections!
ActiveRecord::Migration::Current.class_eval do
  create_table :users do |t|
    t.string :name
  end
  create_table :posts do |t|
    t.references :user
    t.string :title
    t.text :body
    t.timestamps
  end

  create_table :comments do |t|
    t.references :post
    t.references :user
    t.text :body
    t.timestamps
  end

  create_table :stars do |t|
    t.string :type
    t.references :comment
    t.references :user
    t.timestamps
  end
end

srand 0
users = 4.times.map { |i| { name: "User#{i}" } }
User.import users
user_ids = User.ids

posts = 16.times.map do |i|
  { user_id: user_ids.sample, title: "Post#{i}", body: "post #{i}" }
end
Post.import posts
post_ids = Post.ids

comments = 64.times.map do |i|
  { user_id: user_ids.sample, post_id: post_ids.sample, body: "comment #{i}" }
end
Comment.import comments
comment_ids = Comment.ids

sets = Set.new
color_klasses = ['YellowStar', 'RedStar', 'GreenStar']
stars = 128.times.map do
  type = color_klasses.sample
  user_id = user_ids.sample
  comment_id = comment_ids.sample
  while sets.include? [user_id, comment_id]
    user_id = user_ids.sample
    comment_id = comment_ids.sample
  end
  sets.add [user_id, comment_id]
  { type: type, user_id: user_id, comment_id: comment_id }
end
Star.import stars

p users.size, posts.size, comments.size, stars.size
