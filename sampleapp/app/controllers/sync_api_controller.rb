class SyncApiController < ApplicationController
  include ArSync::ApiControllerConcern
  serializer_field :newposts, type: [Post] do
    Post.sync_collection(:latest10)
  end
  serializer_field :profile, type: User do |user|
    user
  end
  serializer_field :user, type: User do |_user, id:|
    User.find id
  end
  serializer_field :post, type: Post do |_user, id:|
    Post.find id
  end
  serializer_field :comment, type: Comment do |_user, id:|
    Comment.find id
  end

  # fields for graph sync
  serializer_field Follow.name, type: [Follow] do |_user, ids:|
    Follow.where id: ids
  end
  serializer_field Reaction.name, type: [Reaction] do |_user, ids:|
    Reaction.where id: ids
  end
  serializer_field User.name, type: [User] do |_user, ids:|
    User.where id: ids
  end
  serializer_field Post.name, type: [Post] do |_user, ids:|
    Post.where id: ids
  end
  serializer_field Comment.name do |_user, ids:|
    Comment.where id: ids
  end
end
