require 'pry'
require_relative 'db'
require 'ar_sync'

class User < ActiveRecord::Base
  has_many :posts, dependent: :destroy
  sync_has_data :id, :name
  sync_has_many :posts
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }
end

class Post < ActiveRecord::Base
  belongs_to :user
  has_many :comments, dependent: :destroy

  sync_define_collection :all
  sync_define_collection :first10, limit: 10, order: :asc
  sync_define_collection :last10, limit: 10, order: :desc

  sync_parent :user, inverse_of: :do_not_call_after_destroyed
  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body
  sync_has_data :user do
    { name: user.name }
  end
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }
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
  has_many :stars, dependent: :destroy
  sync_parent :post, inverse_of: :do_not_call_after_destroyed
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :my_comments, only_to: :user
  sync_has_data :id, :body
  sync_has_data :user do
    { name: user.name }
  end
  sync_has_data(:star_count, preload: lambda { |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }

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
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }
  sync_parent :comment, inverse_of: :do_not_call_after_destroyed
  sync_parent :comment, inverse_of: :star_count
  sync_parent :comment, inverse_of: :my_star, only_to: -> { user }
  sync_parent :comment, inverse_of: :my_stars, only_to: -> { user }
end
