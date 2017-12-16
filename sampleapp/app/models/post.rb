class Post < ApplicationRecord
  belongs_to :user
  has_many :comments
  has_many :reactions, as: :target
end
