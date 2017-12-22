module ARSync
  module Rails
    class Engine < ::Rails::Engine
    end
  end

  self.on_update do |key:, action:, path:, data:|
    ActionCable.server.broadcast key, action: action, path: path, data: data
  end

  self.config.key_prefix = 'ar_sync_'
  self.config.current_user_method = :current_user

  module ARSyncApiControllerConcern
    def send_sync_api(model, query)
      if respond_to?(ARSync.config.current_user_method)
        current_user = send ARSync.config.current_user_method
      end
      render json: ARSync.sync_api(model, current_user, *query.as_json)
    end
  end

  ActionController::Base.include ARSyncApiControllerConcern

end
