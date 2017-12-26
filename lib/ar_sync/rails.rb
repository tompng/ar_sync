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

  module StaticJsonConcern
    def ar_sync_static_json(record_or_records, query)
      if respond_to?(ARSync.config.current_user_method)
        current_user = send ARSync.config.current_user_method
      end
      ARSync.serialize(record_or_records, current_user, query.as_json)
    end
  end

  ActionController::Base.include StaticJsonConcern

  module ApiControllerConcern
    extend ActiveSupport::Concern
    module ClassMethods
      def api(name, &block)
        configured_apis[name.to_s] = block
      end

      def configured_apis
        @configured_apis ||= {}
      end
    end

    included do
      protect_from_forgery except: :api_call
    end

    def api_call
      if respond_to?(ARSync.config.current_user_method)
        current_user = send ARSync.config.current_user_method
      end
      api_responses = {}
      params[:requests].each do |name, req|
        api_name = req[:api]
        api = self.class.configured_apis[api_name.to_s]
        raise "Sync API named `#{api_name}` not configured" unless api
        api_params = req[:params] || {}
        model = instance_exec api_params, &api
        if model.is_a? ARSync::Collection
          api_responses[name] = ARSync.sync_collection_api(model, current_user, *req[:query].as_json) if model
        else
          api_responses[name] = ARSync.sync_api(model, current_user, *req[:query].as_json) if model
        end
      end
      render json: api_responses
    end
  end
end
