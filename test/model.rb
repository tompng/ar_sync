require_relative 'db'
require 'ar_sync'

class BaseRecord < ActiveRecord::Base
  include ArSync::ModelBase
  self.abstract_class = true
end

class User < BaseRecord
  self.table_name = :users
  has_many :posts, dependent: :destroy
  sync_has_data :id, :name
  sync_has_many :posts
  sync_has_one(:postOrNull, type: ->{ [Post, nil] }) { nil }
  sync_has_data(:itemWithId) { { id: 1, value: 'data' } }
  sync_has_data(:itemsWithId) { [{ id: 1, value: 'data' }] }
end

class Post < BaseRecord
  self.table_name = :posts
  belongs_to :user
  has_many :comments, dependent: :destroy

  sync_define_collection :all
  sync_define_collection :first10, limit: 10, order: :asc
  sync_define_collection :last10, limit: 10, order: :desc

  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body
  sync_has_data(:titleChars) { (title || '').chars }
  sync_has_one :user, only: [:id, :name]
  sync_has_many :comments
  sync_has_many :myComments, preload: lambda { |posts, user|
    Comment.where(post_id: posts.map(&:id), user: user).group_by(&:post_id)
  } do |preloaded|
    preloaded[id] || []
  end
end

class Comment < BaseRecord
  self.table_name = :comments
  belongs_to :user
  belongs_to :post
  has_many :stars, dependent: :destroy
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :myComments, only_to: :user
  sync_has_data :id, :body
  sync_has_one :user, only: [:id, :name]
  sync_has_data(:starCount, preload: lambda { |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }

  define_preloader :my_stars_loader do |comments, user|
    Star.where(user: user, comment_id: comments.map(&:id)).group_by(&:comment_id)
  end

  sync_has_one :myStar, preload: :my_stars_loader do |preloaded|
    preloaded[id]&.first
  end
  sync_has_many :myStars, preload: :my_stars_loader do |preloaded|
    preloaded[id] || []
  end

  sync_has_data :editedStarCount, preload: ->(comments) do
    counts = Star.where('created_at != updated_at').where(comment_id: comments.map(&:id)).group(:comment_id).count
    Hash.new(0).merge counts
  end
end

class Star < BaseRecord
  self.table_name = :stars
  belongs_to :user
  belongs_to :comment
  sync_has_data :id, :created_at, :type
  sync_has_one :user, only: [:id, :name]
  sync_parent :comment, inverse_of: :starCount
  sync_parent :comment, inverse_of: :myStar, only_to: -> { user }
  sync_parent :comment, inverse_of: :myStars, only_to: -> { user }
  sync_parent :comment, inverse_of: :editedStarCount, watch: :updated_at
end

class YellowStar < Star; end
class RedStar < Star; end
class GreenStar < Star; end
