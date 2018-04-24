class Reaction < ApplicationRecord
  Kinds = %i(like dislike)
  belongs_to :target, polymorphic: true
  belongs_to :user

  sync_field :kind, :created_at, :user
  sync_parent :target, inverse_of: :reactions
  sync_parent :target, affects: :reaction_summary
  sync_parent :target, inverse_of: :my_reaction, only_to: -> { user }
end
