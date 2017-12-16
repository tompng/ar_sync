class Reaction < ApplicationRecord
  Kinds = %i(like dislike)
  belongs_to :target, polymorphic: true
  belongs_to :user
end
