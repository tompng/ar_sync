class Post < ApplicationRecord
  belongs_to :user
  has_many :comments, dependent: :destroy
  has_many :reactions, as: :target, dependent: :destroy

  sync_define_collection :latest10, limit: 10, order: :desc
  sync_parent :user, inverse_of: :posts
  sync_field :title, :body, :created_at, :updated_at, :comments, :user
  sync_field :comments_last5, association: :comments, order: :desc, limit: 5
  sync_field :comments_count, count_of: :comments
  include SyncReactionConcern
end
