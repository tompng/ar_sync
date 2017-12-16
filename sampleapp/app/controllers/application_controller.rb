class ApplicationController < ActionController::Base
  protect_from_forgery with: :exception
  before_action :authenticate_user!

  def authenticate_user!
    redirect_to new_session_path unless current_user
  end

  helper_method def current_user
    @current_user ||= User.find_by id: session[:id]
  end
end
