class User < ApplicationRecord
  has_many :posts, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :reactions, dependent: :destroy
  has_many :followings, class_name: 'Follow', foreign_key: :from_id, dependent: :destroy
  has_many :followeds, class_name: 'Follow', foreign_key: :to_id, dependent: :destroy
  has_many :following_users, through: :followings, source: :to
  has_many :followed_users, through: :followeds, source: :from

  sync_field :name, :posts, :followings, :followeds
  sync_field :is_following, preload: lambda { |users, current_user|
    Set.new Follow.where(from: current_user, to: users).pluck(:to_id)
  } do |preloaded|
    preloaded.include? id
  end
  sync_field :is_followed, preload: lambda { |users, current_user|
    Set.new Follow.where(from: users, to: current_user).pluck(&:from_id)
  } do |preloaded|
    preloaded.include? id
  end
  sync_field :following_count, count_of: :followings
  sync_field :followed_count, count_of: :followeds
end
