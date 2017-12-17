class CommentsController < ApplicationController
  def sync_api
    render json: ARSync.sync_api(Comment.find(params[:id]), current_user, *params[:query])
  end

  def show
  end

  def create
    Post.find(params[:post_id]).comments.create permitted_params
    head :ok
  end

  def update
    current_user.comments.find(params[:id]).update permitted_params
    head :ok
  end

  def destroy
    current_user.comments.find(params[:id]).destroy
    head :ok
  end

  def reaction
    kind = params[:kind].presence
    reaction = Comment.find(params[:id]).reactions.find_by(user: current_user)
    if kind
      if reaction
        reaction.update kind: kind
      else
        Comment.find(params[:id]).reactions.create(user: current_user, kind: kind)
      end
    else
      reaction&.destroy
    end
  end

  def permitted_params
    @params.permit :body
  end
end
