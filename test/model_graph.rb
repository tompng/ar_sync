require_relative 'db'
require 'ar_sync'

module Graph
  class BaseRecord < ActiveRecord::Base
    self.abstract_class = true
  end
end
ArSync.use :graph, klass: Graph::BaseRecord

class Graph::User < Graph::BaseRecord
  self.table_name = :users
  has_many :posts, dependent: :destroy
  sync_field :id, :name, :posts
  sync_field(:do_not_call_after_destroyed) { raise if destroyed? }
end

class Graph::Post < Graph::BaseRecord
  self.table_name = :posts
  belongs_to :user
  has_many :comments, dependent: :destroy

  sync_define_collection :all
  sync_define_collection :first10, limit: 10, order: :asc
  sync_define_collection :last10, limit: 10, order: :desc

  sync_parent :user, affects: :do_not_call_after_destroyed
  sync_parent :user, inverse_of: :posts
  sync_field :id, :title, :body, :user, :comments
  sync_field(:do_not_call_after_destroyed) { raise if destroyed? }
  sync_field :my_comments, preload: lambda { |posts, user|
    Graph::Comment.where(post_id: posts.map(&:id), user: user).group_by(&:post_id)
  } do |preloaded|
    preloaded[id] || []
  end
end

class Graph::Comment < Graph::BaseRecord
  self.table_name = :comments
  belongs_to :user
  belongs_to :post
  has_many :stars, dependent: :destroy
  sync_parent :post, affects: :do_not_call_after_destroyed
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :my_comments, only_to: :user
  sync_field :id, :body, :user
  sync_field(:star_count, preload: lambda { |comments|
    Graph::Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }
  sync_field(:do_not_call_after_destroyed) { raise if destroyed? }

  define_preloader :my_stars_loader do |comments, user|
    Graph::Star.where(user: user, comment_id: comments.map(&:id)).group_by(&:comment_id)
  end

  sync_field :my_star, preload: :my_stars_loader do |preloaded|
    preloaded[id]&.first
  end
  sync_field :my_stars, preload: :my_stars_loader do |preloaded|
    preloaded[id] || []
  end
end

class Graph::Star < Graph::BaseRecord
  self.table_name = :stars
  belongs_to :user
  belongs_to :comment
  sync_field :id, :created_at, :user
  sync_field(:do_not_call_after_destroyed) { raise if destroyed? }
  sync_parent :comment, affects: :do_not_call_after_destroyed
  sync_parent :comment, affects: :star_count
  sync_parent :comment, inverse_of: :my_star, only_to: -> { user }
  sync_parent :comment, inverse_of: :my_stars, only_to: -> { user }
end
