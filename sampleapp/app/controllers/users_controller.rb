class UsersController < ApplicationController
  protect_from_forgery except: [:sync_api, :proflie_sync_api]
  def sync_api
    render json: ARSync.sync_api(User.find(params[:id]), current_user, *params[:query].as_json)
  end

  def profile_sync_api
    render json: ARSync.sync_api(current_user, current_user, *params[:query].as_json)
  end

  def index
    @users = User.all
  end

  def show
  end
end
