require_relative 'model'
class User
  include ARPreload
  preloadable :id, :name
  preloadable :posts, includes: :posts
end

class Post
  include ARPreload
  preloadable :id, :title, :body
  preloadable :user, includes: :user
  preloadable :comments, includes: :comments
  preloadable :comment_count, preload: lambda { |posts|
    Comment.where(post_id: posts.map(&:id)).group(:post_id).count
  } do |preload|
    preload[id] || 0
  end
end

class Comment
  include ARPreload
  preloadable :id, :body
  preloadable :user, includes: :user
  preloadable :stars_count, preload: lambda { |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  } do |preload|
    preload[id] || 0
  end
  preloadable :stars, includes: :stars
end

class Star
  include ARPreload
  preloadable :user, includes: :user
end

ARPreload::Serializer.serialize User.first, :id, posts: { comments: :stars_count }
# User Load (0.2ms)  SELECT  "users".* FROM "users" ORDER BY "users"."id" ASC LIMIT ?  [["LIMIT", 1]]
# Post Load (0.3ms)  SELECT "posts".* FROM "posts" WHERE "posts"."user_id" = 1
# Comment Load (2.9ms)  SELECT "comments".* FROM "comments" WHERE "comments"."post_id" IN (1, 7, 8, 10, 15)
#  (0.2ms)  SELECT COUNT(*) AS count_all, "stars"."comment_id" AS stars_comment_id FROM "stars" WHERE "stars"."comment_id" IN (22, 29, 35, 60, 16, 62, 64, 5, 26, 30, 31, 40, 46) GROUP BY "stars"."comment_id"
# => {:id=>1,
#  :posts=>
#   [{:comments=>[{:stars_count=>4}, {:stars_count=>3}, {:stars_count=>3}]},
#    {:comments=>[{:stars_count=>2}]},
#    {:comments=>[{:stars_count=>0}, {:stars_count=>2}, {:stars_count=>2}]},
#    {:comments=>[{:stars_count=>1}, {:stars_count=>5}, {:stars_count=>3}, {:stars_count=>2}]},
#    {:comments=>[{:stars_count=>4}, {:stars_count=>3}]}]}

binding.pry
