class SyncChannel < ApplicationCable::Channel
  def subscribed
    stream_from params[:key]
  end
end
