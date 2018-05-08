module ArSync
  module Rails
    class Engine < ::Rails::Engine
    end
  end

  self.on_notification do |events|
    events.each do |key, patch|
      ActionCable.server.broadcast key, patch
    end
  end

  self.config.key_prefix = 'ar_sync_'
  self.config.current_user_method = :current_user

  module StaticJsonConcern
    def ar_sync_static_json(record_or_records, query)
      if respond_to?(ArSync.config.current_user_method)
        current_user = send ArSync.config.current_user_method
      end
      ArSync.serialize(record_or_records, query.as_json, user: current_user)
    end
  end

  ActionController::Base.class_eval do
    include StaticJsonConcern
    def action_with_compact_ar_sync_notification(&block)
      ArSync.with_compact_notification(&block)
    end
    around_action :action_with_compact_ar_sync_notification
  end

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
      protect_from_forgery except: [:sync_call, :static_call]
    end

    def _api_call(type, api_list)
      if respond_to?(ArSync.config.current_user_method)
        current_user = send ArSync.config.current_user_method
      end
      responses = params[:requests].map do |request|
        api_name = request[:api]
        api = api_list[api_name.to_s]
        raise "#{type.to_s.capitalize} API named `#{api_name}` not configured" unless api
        api_params = request[:params] || {}
        model = instance_exec api_params, &api
        yield model, current_user, request[:query].as_json
      end
      render json: responses
    end

    def sync_call
      _api_call :sync, self.class.configured_sync_apis do |model, current_user, query|
        case model
        when ArSync::Collection
          ArSync.sync_collection_api model, current_user, query
        when ActiveRecord::Base
          ArSync.sync_api model, current_user, query
        end
      end
    end

    def static_call
      _api_call :static, self.class.configured_static_apis do |model, current_user, query|
        case model
        when ArSync::Collection, ActiveRecord::Relation, Array
          ArSync.serialize model.to_a, query, user: current_user
        when ActiveRecord::Base
          ArSync.serialize model, query, user: current_user
        else
          model
        end
      end
    end
  end
end
