class UsersController < ApplicationController
  protect_from_forgery except: [:sync_api, :proflie_sync_api]
  def sync_api
    send_sync_api User.find(params[:id]), params[:query]
  end

  def profile_sync_api
    send_sync_api current_user, params[:query]
  end

  def index
    @users = User.all
  end

  def show
  end
end
