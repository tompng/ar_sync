class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :post
  has_many :reactions, as: :target, dependent: :destroy

  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :comments_last5
  sync_parent :post, inverse_of: :comments_count
  sync_has_data :post_id, :body, :created_at, :updated_at
  if sampleapp_ar_sync_graph?
    sync_has_one :user
  else
    sync_has_data(:user, includes: :user) { user.as_json(only: [:id, :name]) }
  end
  include SyncReactionConcern
end
