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
    t.references :comment
    t.references :user
    t.timestamps
  end
end

users = Array.new 10 do |i|
  User.create name: "User#{i}"
end
posts = Array.new 40 do |i|
  Post.create user: users.sample, title: "Post#{i}", body: "post #{i}"
end
comments = Array.new 40 do |i|
  Comment.create user: users.sample, post: posts.sample, body: "post #{i}"
end
stars = Array.new 100 do
  Star.create user: users.sample, comment: comments.sample
end
p users.size, posts.size, comments.size, stars.size

binding.pry
