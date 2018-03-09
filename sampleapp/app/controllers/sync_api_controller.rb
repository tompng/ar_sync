class SyncApiController < ApplicationController
  include ArSync::ApiControllerConcern

  api :newposts do |_params|
    Post.sync_collection(:latest10)
  end

  api :profile do |_params|
    current_user
  end

  api :user do |params|
    User.find params[:id]
  end

  api :post do |params|
    Post.find params[:id]
  end

  api :comment do |params|
    Comment.find params[:id]
  end
end
