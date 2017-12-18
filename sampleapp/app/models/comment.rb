class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :post
  has_many :reactions, as: :target, dependent: :destroy

  include ARSync
  sync_self
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :comments_count
  sync_has_data :post_id, :body, :created_at, :updated_at
  sync_has_data(:user, includes: :user) { user.as_json(only: [:id, :name]) }
  include SyncReactionConcern
end
