class User < ApplicationRecord
  has_many :posts, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :reactions, dependent: :destroy
  has_many :followings, class_name: 'Follow', foreign_key: :from_id, dependent: :destroy
  has_many :followeds, class_name: 'Follow', foreign_key: :to_id, dependent: :destroy
  has_many :following_users, through: :followings, source: :to
  has_many :followed_users, through: :followeds, source: :from

  include ARSync
  sync_self
  sync_has_data :name
  sync_has_many :posts
  sync_has_many :followings
  sync_has_many :followeds
  sync_has_data :is_following, preload: lambda { |users, current_user|
    Set.new Follow.where(from: current_user, to: users).pluck(:to_id)
  } do |preloaded|
    preloaded.include? id
  end
  sync_has_data :is_followed, preload: lambda { |users, current_user|
    Follow.where(from: users, to: current_user).pluck(&:from_id)
  } do |preloaded|
    preloaded.include? id
  end
  sync_has_data :following_count, preload: lambda { |users|
    Follow.where(from: users).group(:from_id).count
  } do |preloaded|
    preloaded[id] || 0
  end
  sync_has_data :followed_count, preload: lambda { |users|
    Follow.where(to: users).group(:to_id).count
  } do |preloaded|
    preloaded[id] || 0
  end
end
