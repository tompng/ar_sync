class SyncChannel < ApplicationCable::Channel
  def subscribed
    puts "#\e[1msync_#{params}\e[m"
    stream_from "sync_#{params[:key]}"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
