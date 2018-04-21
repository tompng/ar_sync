class SyncApiController < ApplicationController
  include ArSync::ApiControllerConcern

  api User do |ids|
    User.where id: ids
  end

  api Post do |ids|
    Post.where id: ids
  end

  api Comment do |ids|
    Comment.where id: ids
  end

  api :newposts do |_params|
    Post.sync_collection(:latest10)
  end

  api :profile do |_params|
    current_user
  end
end
