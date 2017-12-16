class SessionsController < ApplicationController
  skip_before_action :authenticate_user!
  def new
  end

  def create
  end

  def destroy
  end
end
