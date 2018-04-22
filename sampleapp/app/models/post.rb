class Post < ApplicationRecord
  belongs_to :user
  has_many :comments, dependent: :destroy
  has_many :reactions, as: :target, dependent: :destroy

  sync_define_collection :latest10, limit: 10, order: :desc
  sync_parent :user, inverse_of: :posts
  sync_has_data :title, :body, :created_at, :updated_at
  sync_has_many :comments
  sync_has_many :comments_last5, association: :comments, order: :desc, limit: 5
  sync_has_data :comments_count, count_of: :comments
  sync_has_one :user
  include SyncReactionConcern
end
