class CommentsController < ApplicationController
  def show
    @comment = Comment.find params[:id]
  end

  def edit
    @comment = current_user.comments.find params[:id]
  end

  def create
    post = Post.find(params[:post_id])
    post.comments.where(user: current_user).new(permitted_params).save!
    head :ok
  end

  def update
    comment = current_user.comments.find_by(id: params[:id], user: current_user)
    comment.update! permitted_params
    respond_to do |format|
      format.html { redirect_to comment }
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
    comment = Comment.find params[:id]
    reaction = comment.reactions.find_by user: current_user
    if kind && kind != 'null'
      if reaction
        reaction.update kind: kind
      else
        comment.reactions.create user: current_user, kind: kind
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
