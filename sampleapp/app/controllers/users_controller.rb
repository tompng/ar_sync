class UsersController < ApplicationController
  def sync_api
    render json: ARSync.sync_api(User.find(params[:id]), current_user, *params[:query])
  end

  def profile_sync_api
    render json: ARSync.sync_api(current_user, current_user, *params[:query])
  end
end
