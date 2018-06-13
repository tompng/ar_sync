module ArSync
  module Rails
    class Engine < ::Rails::Engine; end
  end

  class ApiNotFound < StandardError; end

  on_notification do |events|
    events.each do |key, patch|
      ActionCable.server.broadcast key, patch
    end
  end

  on_update do |key, patch|
    ActionCable.server.broadcast key, patch
  end

  config.key_prefix = 'ar_sync_'
  config.current_user_method = :current_user

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
        begin
          api_name = req[:api]
          api = self.class.configured_apis[api_name.to_s]
          raise ArSync::ApiNotFound, "API named `#{api_name}` not configured" unless api
          api_params = req[:params] || {}
          model = instance_exec api_params, &api
          { data: yield(model, current_user, req[:query].as_json) }
        rescue StandardError => e
          { error: handle_exception(e) }
        end
      end
      render json: api_responses
    end

    def log_internal_error(e)
      logger.error e
    end

    def handle_exception(e)
      log_internal_error e
      case e
      when ArSerializer::InvalidQuery, ArSync::ApiNotFound
        { type: 'Bad Request', message: e.message }
      when ActiveRecord::RecordNotFound
        { type: 'Record Not Found', message: e.message }
      else
        message = "#{e.class.name} #{e.message}" unless ::Rails.env.production?
        { type: 'Internal Server Error', message: message }
      end
    end

    def api_call
      _api_call do |model, current_user, query|
        serialized = ArSerializer.serialize model, query, context: current_user, include_id: true, use: :sync
        next serialized unless model.is_a? ArSync::Collection
        {
          sync_keys: ArSync.sync_keys(model, current_user),
          order: { mode: model.order, limit: model.limit },
          collection: serialized
        }
      end
    end
  end
end
