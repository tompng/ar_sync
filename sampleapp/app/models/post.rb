class Post < ApplicationRecord
  belongs_to :user
  has_many :comments, dependent: :destroy
  has_many :reactions, as: :target, dependent: :destroy

  sync_parent :user, inverse_of: :posts
  sync_self
  sync_has_data :title, :body, :created_at, :updated_at
  sync_has_many :comments
  sync_has_data :comments_count, preload: lambda { |posts|
    Comment.where(post_id: posts.map(&:id)).group(:post_id).count
  } do |preloaded|
    preloaded[id] || 0
  end
  sync_has_data(:user, includes: :user) { user.as_json(only: [:id, :name]) }
  include SyncReactionConcern
end
