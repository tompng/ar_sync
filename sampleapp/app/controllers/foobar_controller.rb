class FoobarController < ApplicationController
  def show
    render html: 'hello world', layout: true
  end

  def broadcast
    ActionCable.server.broadcast("sync_#{params[:key]}", params[:data])
    render html: 'ok'
  end
end
