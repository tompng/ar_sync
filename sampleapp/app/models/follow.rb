class Follow < ApplicationRecord
  belongs_to :from, class_name: 'User'
  belongs_to :to, class_name: 'User'
  sync_parent :from, affects: :following_count
  sync_parent :to, affects: :followed_count
  sync_parent :from, inverse_of: :followings
  sync_parent :to, inverse_of: :followings
  sync_parent :from, affects: :is_followed, only_to: -> { to }
  sync_parent :to, affects: :is_following, only_to: -> { from }
  sync_field :from, :to
end
