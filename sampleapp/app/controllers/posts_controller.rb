class PostsController < ApplicationController
  def sync_api
    render json: ARSync.sync_api(Post.find(params[:id]), current_user, *params[:query])
  end

  def show
  end

  def create
    current_user.posts.create permitted_params
    head :ok
  end

  def update
    current_user.posts.find(params[:id]).update permitted_params
    head :ok
  end

  def destroy
    current_user.posts.find(params[:id]).destroy
    head :ok
  end

  def reaction
    kind = params[:kind].presence
    reaction = Post.find(params[:id]).reactions.find_by(user: current_user)
    if kind
      if reaction
        reaction.update kind: kind
      else
        Post.find(params[:id]).reactions.create(user: current_user, kind: kind)
      end
    else
      reaction&.destroy
    end
  end


  def permitted_params
    @params.permit :title, :body
  end
end
