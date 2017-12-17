class Comment < ApplicationRecord
  belongs_to :user
  belongs_to :post
  has_many :reactions, as: :target

  include ARSync
  sync_self
  sync_parent :post, inverse_of: :comments
  sync_parent :post, inverse_of: :comments_count
  sync_has_data :body
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  include SyncReactionConcern
end
