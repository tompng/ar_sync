require 'activerecord-import'
require_relative 'db'
require_relative 'model_tree'
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
    t.references :comment
    t.references :user
    t.timestamps
  end
end

srand 0
users = 4.times.map { |i| { name: "User#{i}" } }
user_ids = Tree::User.import(users).ids

posts = 16.times.map do |i|
  { user_id: user_ids.sample, title: "Post#{i}", body: "post #{i}" }
end
post_ids = Tree::Post.import(posts).ids

comments = 64.times.map do |i|
  { user_id: user_ids.sample, post_id: post_ids.sample, body: "comment #{i}" }
end
comment_ids = Tree::Comment.import(comments).ids

sets = Set.new
stars = 128.times.map do
  user_id = user_ids.sample
  comment_id = comment_ids.sample
  while sets.include? [user_id, comment_id]
    user_id = user_ids.sample
    comment_id = comment_ids.sample
  end
  sets.add [user_id, comment_id]
  { user_id: user_id, comment_id: comment_id }
end
Tree::Star.import stars

p users.size, posts.size, comments.size, stars.size
