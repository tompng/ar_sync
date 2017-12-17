class CommentsController < ApplicationController
  protect_from_forgery except: :sync_api
  def sync_api
    render json: ARSync.sync_api(Comment.find(params[:id]), current_user, *params[:query].as_json)
  end

  def show
    @comment = Comment.find params[:id]
  end

  def edit
    @comment = current_user.comments.find params[:id]
  end

  def create
    post = Post.find(params[:post_id])
    post.comments.where(user: current_user).create! permitted_params
    head :ok
  end

  def update
    comment = current_user.comments.find_by(id: params[:id], user: current_user)
    comment.update! permitted_params
    respond_to do |format|
      format.html { redirect_to comment.post }
      format.json { head :ok }
    end
  end

  def destroy
    comment = current_user.comments.find_by!(user: current_user, id: params[:id])
    comment.destroy!
    respond_to do |format|
      format.html { redirect_to comment.post }
      format.json { head :ok }
    end
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
    head :ok
  end

  def permitted_params
    params[:comment].permit :body
  end
end
