require 'pry'
require_relative 'db'
require_relative 'ar_sync'

class User < ActiveRecord::Base
  include ARSync
  has_many :posts
  sync_self
  sync_has_data :id
  sync_has_data :name
  sync_has_many :posts, inverse_of: :user
end

class Post < ActiveRecord::Base
  include ARSync
  belongs_to :user
  has_many :comments
  sync_self
  sync_belongs_to :user, as: :posts
  sync_has_data :id
  sync_has_data :title
  sync_has_data :body
  sync_has_data :user, includes: :user
  sync_has_many :comments, inverse_of: :post
end

class Comment < ActiveRecord::Base
  include ARSync
  belongs_to :user
  belongs_to :post
  has_many :stars
  sync_self
  sync_belongs_to :post, as: :comments
  sync_has_data :id
  sync_has_data :body
  sync_has_data :user, includes: :user
  sync_has_data(:star_count, preload: lambda { |models|
    Star.where(comment_id: models.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }

  define_preloader :star_count_loader do |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  end

  sync_has_data(:star_count_by_custom_preloader, preload: [:star_count_loader]) { |preload| preload[id] || 0 }

end

class Star < ActiveRecord::Base
  include ARSync
  belongs_to :user
  belongs_to :comment
  sync_belongs_to :comment, as: :star_count
end
