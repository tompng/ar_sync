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
  sync_has_data :id, :name
  sync_has_many :posts
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }
end

class Graph::Post < Graph::BaseRecord
  self.table_name = :posts
  belongs_to :user
  has_many :comments, dependent: :destroy

  sync_define_collection :all
  sync_define_collection :first10, limit: 10, order: :asc
  sync_define_collection :last10, limit: 10, order: :desc

  sync_parent :user, inverse_of: :do_not_call_after_destroyed
  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body
  sync_has_data(:titleChars) { (title || '').chars }
  sync_has_one :user, only: [:id, :name]
  sync_has_many :comments
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }
  sync_has_many :myComments, preload: lambda { |posts, user|
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
  sync_parent :post, inverse_of: :do_not_call_after_destroyed
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :myComments, only_to: :user
  sync_has_data :id, :body
  sync_has_one :user, only: [:id, :name]
  sync_has_data(:starCount, preload: lambda { |comments|
    Graph::Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  }) { |preload| preload[id] || 0 }
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }

  define_preloader :my_stars_loader do |comments, user|
    Graph::Star.where(user: user, comment_id: comments.map(&:id)).group_by(&:comment_id)
  end

  sync_has_one :myStar, preload: :my_stars_loader do |preloaded|
    preloaded[id]&.first
  end
  sync_has_many :myStars, preload: :my_stars_loader do |preloaded|
    preloaded[id] || []
  end
end

class Graph::Star < Graph::BaseRecord
  self.table_name = :stars
  belongs_to :user
  belongs_to :comment
  sync_has_data :id, :created_at
  sync_has_one :user, only: [:id, :name]
  sync_has_data(:do_not_call_after_destroyed) { raise if destroyed? }
  sync_parent :comment, inverse_of: :do_not_call_after_destroyed
  sync_parent :comment, inverse_of: :starCount
  sync_parent :comment, inverse_of: :myStar, only_to: -> { user }
  sync_parent :comment, inverse_of: :myStars, only_to: -> { user }
end
