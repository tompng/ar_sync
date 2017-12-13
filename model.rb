require 'pry'
require_relative 'db'
require_relative 'ar_sync'

class User < ActiveRecord::Base
  include ARSync
  has_many :posts
  sync_self
  sync_has_data :id
  sync_has_data :name
  sync_has_many :posts
end

class Post < ActiveRecord::Base
  include ARSync
  belongs_to :user
  has_many :comments
  sync_self
  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_has_many :comments
end

class Comment < ActiveRecord::Base
  include ARSync
  belongs_to :user
  belongs_to :post
  has_many :stars
  sync_self
  sync_parent :post, inverse_of: :comments
  sync_has_data :id, :body
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_has_data(:star_count, preload: lambda { |models|
    Star.where(comment_id: models.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }

  define_preloader :star_count_loader do |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  end

  sync_has_data(:star_count_by_custom_preloader, preload: [:star_count_loader]) { |preload| preload[id] || 0 }

  sync_has_many :my_stars, preload: ->(comments, user) {
    Star.where(user: user, comment_id: comments.map(&:id)).group_by(&:comment_id)
  } do |preloaded|
    preloaded[id] || []
  end
end

class Star < ActiveRecord::Base
  include ARSync
  belongs_to :user
  belongs_to :comment
  sync_has_data :id, :created_at
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_parent :comment, inverse_of: :star_count
  sync_parent :comment, inverse_of: :star_count_by_custom_preloader
  sync_parent :comment, inverse_of: :my_stars, only_to: -> { user }
end
