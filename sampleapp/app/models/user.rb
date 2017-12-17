class User < ApplicationRecord
  has_many :posts
  has_many :followings, class_name: 'Follow', foreign_key: :from_id
  has_many :followeds, class_name: 'Follow', foreign_key: :to_id
  has_many :following_users, through: :followings, source: :to
  has_many :followed_users, through: :followeds, source: :from

  include ARSync
  sync_self
  sync_has_data :name
  sync_has_many :posts
end
