module ARSync
  module Rails
    class Engine < ::Rails::Engine
    end
  end

  self.on_update do |key:, action:, path:, data:|
    ActionCable.server.broadcast key, action: action, path: path, data: data
  end

  self.config.key_prefix = 'ar_sync_'
end
