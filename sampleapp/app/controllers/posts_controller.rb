class PostsController < ApplicationController
  protect_from_forgery except: :sync_api
  def sync_api
    send_sync_api Post.find(params[:id]), params[:query]
  end

  def show
  end

  def new
    @post = Post.new
  end

  def edit
    @post = current_user.posts.find params[:id]
  end

  def create
    post = current_user.posts.create! permitted_params
    respond_to do |format|
      format.html { redirect_to post }
      format.json { head :ok }
    end
  end

  def update
    post = current_user.posts.find(params[:id])
    post.update! permitted_params
    respond_to do |format|
      format.html { redirect_to post }
      format.json { head :ok }
    end
  end

  def destroy
    current_user.posts.find(params[:id]).destroy!
    respond_to do |format|
      format.html { redirect_to root_path }
      format.json { head :ok }
    end
  end

  def reaction
    kind = params[:kind].presence
    reaction = Post.find(params[:id]).reactions.find_by(user: current_user)
    if kind
      if reaction
        reaction.update! kind: kind
      else
        Post.find(params[:id]).reactions.create!(user: current_user, kind: kind)
      end
    else
      reaction&.destroy!
    end
    head :ok
  end

  def permitted_params
    params[:post].permit :title, :body
  end
end
