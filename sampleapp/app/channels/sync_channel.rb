class SyncChannel < ApplicationCable::Channel
  def subscribed
    key = ArSync.validate_expiration params[:key]
    stream_from key if key
  end
end
