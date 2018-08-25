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

  config.key_prefix = 'ar_sync_'
  config.current_user_method = :current_user

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
    include ArSerializer::Serializable

    included do
      protect_from_forgery except: [:sync_call, :static_call]
    end

    def _api_call(type)
      if respond_to?(ArSync.config.current_user_method)
        current_user = send ArSync.config.current_user_method
      end
      responses = params[:requests].map do |request|
        begin
          api_name = request[:api]
          info = self.class._serializer_field_info api_name
          raise ArSync::ApiNotFound, "#{type.to_s.capitalize} API named `#{api_name}` not configured" unless info
          api_params = (request[:params].as_json || {}).transform_keys(&:to_sym)
          model = instance_exec(current_user, api_params, &info.data_block)
          { data: yield(model, current_user, request[:query].as_json) }
        rescue StandardError => e
          { error: handle_exception(e) }
        end
      end
      render json: responses
    end

    def log_internal_error e
      logger.error e.message
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

    def sync_call
      _api_call :sync do |model, current_user, query|
        case model
        when ArSync::Collection
          ArSync.sync_collection_api model, current_user, query
        when ActiveRecord::Base
          ArSync.sync_api model, current_user, query
        end
      end
    end

    def graphql_schema
      render plain: ArSerializer::GraphQL.definition(self.class)
    end

    def graphql_call
      render json: ArSerializer::GraphQL.serialize(
        self,
        params[:query],
        operation_name: params[:operationName],
        context: current_user
      )
    rescue StandardError => e
      render json: { error: handle_exception(e) }
    end

    def static_call
      _api_call :static do |model, current_user, query|
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
