require 'pry'
require_relative 'db'
require 'ar_sync'

class User < ActiveRecord::Base
  has_many :posts
  sync_self
  sync_has_data :id, :name
  sync_has_many :posts
end

class Post < ActiveRecord::Base
  belongs_to :user
  has_many :comments
  sync_self
  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_has_many :comments
  sync_has_many :my_comments, preload: lambda { |posts, user|
    Comment.where(post_id: posts.map(&:id), user: user).group_by(&:post_id)
  } do |preloaded|
    preloaded[id] || []
  end
end

class Comment < ActiveRecord::Base
  belongs_to :user
  belongs_to :post
  has_many :stars
  sync_self
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :my_comments, only_to: ->{ user }
  sync_has_data :id, :body
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_has_data(:star_count, preload: lambda { |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }

  define_preloader :my_stars_loader do |comments, user|
    Star.where(user: user, comment_id: comments.map(&:id)).group_by(&:comment_id)
  end

  sync_has_one :my_star, preload: :my_stars_loader do |preloaded|
    preloaded[id]&.first
  end
  sync_has_many :my_stars, preload: :my_stars_loader do |preloaded|
    preloaded[id] || []
  end
end

class Star < ActiveRecord::Base
  belongs_to :user
  belongs_to :comment
  sync_has_data :id, :created_at
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_parent :comment, inverse_of: :star_count
  sync_parent :comment, inverse_of: :my_star, only_to: -> { user }
  sync_parent :comment, inverse_of: :my_stars, only_to: -> { user }
end
