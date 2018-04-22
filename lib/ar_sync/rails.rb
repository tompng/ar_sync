module ArSync
  module Rails
    class Engine < ::Rails::Engine
    end
  end

  self.on_update do |key, patch|
    ActionCable.server.broadcast key, patch
  end

  self.config.key_prefix = 'ar_sync_'
  self.config.current_user_method = :current_user

  module StaticJsonConcern
    def ar_sync_static_json(record_or_records, query)
      if respond_to?(ArSync.config.current_user_method)
        current_user = send ArSync.config.current_user_method
      end
      ArSync.serialize(record_or_records, current_user, query.as_json)
    end
  end

  ActionController::Base.include StaticJsonConcern

  module ApiControllerConcern
    extend ActiveSupport::Concern
    module ClassMethods
      def api(name, &block)
        name = name.is_a?(Class) ? name.name : name.to_s
        configured_apis[name] = block
      end

      def configured_apis
        @configured_apis ||= {}
      end
    end

    included do
      protect_from_forgery except: [:api_call]
    end

    def _api_call
      if respond_to?(ArSync.config.current_user_method)
        current_user = send ArSync.config.current_user_method
      end
      api_responses = params[:requests].map do |req|
        api_name = req[:api]
        api = self.class.configured_apis[api_name.to_s]
        raise "API named `#{api_name}` not configured" unless api
        api_params = req[:params] || {}
        model = instance_exec api_params, &api
        yield model, current_user, req[:query].as_json
      end
      render json: api_responses
    end

    def api_call
      _api_call do |model, current_user, query|
        ArSerializer.serialize model, query, context: current_user, include_id: true, use: :sync
      end
    end
  end
end
