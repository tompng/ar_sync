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
      def api(name, only: nil, &block)
        raise 'Option `only` must be :sync or :static' unless only.in?([:sync, :static, nil])
        configured_static_apis[name.to_s] = block if only != :sync
        configured_sync_apis[name.to_s] = block if only != :static
      end

      def configured_sync_apis
        @configured_apis ||= {}
      end

      def configured_static_apis
        @configured_apis ||= {}
      end
    end

    included do
      protect_from_forgery except: :api_call
    end

    def _api_call(type, api_list)
      if respond_to?(ARSync.config.current_user_method)
        current_user = send ARSync.config.current_user_method
      end
      api_responses = {}
      params[:requests].each do |name, req|
        api_name = req[:api]
        api = api_list[api_name.to_s]
        raise "#{type.to_s.capitalize} API named `#{api_name}` not configured" unless api
        api_params = req[:params] || {}
        model = instance_exec api_params, &api
        api_responses[name] = yield model, current_user, req[:query].as_json
      end
      render json: api_responses
    end

    def sync_call
      _api_call :sync, self.class.configured_sync_apis do |model, current_user, query|
        case model
        when ARSync::Collection
          ARSync.sync_collection_api model, current_user, *query
        when ActiveRecord::Base
          ARSync.sync_api model, current_user, *query if model
        end
      end
    end

    def static_call
      _api_call :static, self.class.configured_static_apis do |model, current_user, query|
        case model
        when ARSync::Collection, ActiveRecord::Relation, Array
          ARSync.serialize model.to_a, current_user, query
        when ActiveRecord::Base
          ARSync.serialize model, current_user, query
        else
          model
        end
      end
    end
  end
end
