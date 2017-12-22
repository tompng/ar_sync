class Reaction < ApplicationRecord
  Kinds = %i(like dislike)
  belongs_to :target, polymorphic: true
  belongs_to :user

  sync_has_data :kind, :created_at
  sync_has_data :user, includes: :user do
    { name: user.name }
  end
  sync_parent :target, inverse_of: :reactions
  sync_parent :target, inverse_of: :reaction_summary
  sync_parent :target, inverse_of: :my_reaction, only_to: -> { user }
end
