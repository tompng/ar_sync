class CommentsController < ApplicationController
  def sync_api
    render json: ARSync.sync_api(Comment.find(params[:id]), current_user, *params[:query])
  end
end
