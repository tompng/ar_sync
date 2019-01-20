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

users = Array.new 4 do |i|
  Tree::User.create name: "User#{i}"
end
posts = Array.new 16 do |i|
  Tree::Post.create user: users.sample, title: "Post#{i}", body: "post #{i}"
end
comments = Array.new 64 do |i|
  Tree::Comment.create user: users.sample, post: posts.sample, body: "post #{i}"
end
stars = Array.new 128 do
  Tree::Star.create user: users.sample, comment: comments.sample
end
p users.size, posts.size, comments.size, stars.size
