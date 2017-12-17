class Post < ApplicationRecord
  belongs_to :user
  has_many :comments
  has_many :reactions, as: :target

  include ARSync
  sync_parent :user, inverse_of: :posts
  sync_self
  sync_has_data :title, :body
  sync_has_many :comments
  sync_has_data(:user, includes: :user) { user.as_json(only: :name) }
  include SyncReactionConcern
end
