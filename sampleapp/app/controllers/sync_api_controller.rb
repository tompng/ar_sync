class SyncApiController < ApplicationController
  include ARSync::ApiControllerConcern

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
