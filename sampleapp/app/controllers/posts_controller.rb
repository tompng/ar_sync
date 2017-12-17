class PostsController < ApplicationController
  def sync_api
    render json: ARSync.sync_api(Post.find(params[:id]), current_user, *params[:query])
  end
end
