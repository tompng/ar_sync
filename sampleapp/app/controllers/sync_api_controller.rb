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
  serializer_field :__schema do
    ArSerializer::GraphQL::TypeClass.new SyncApiController
  end
end
