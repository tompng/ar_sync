class SyncChannel < ApplicationCable::Channel
  def subscribed
    stream_from params[:key]
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
