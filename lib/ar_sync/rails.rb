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

  class SyncSchemaBase
    include ArSerializer::Serializable
    serializer_field :__schema do
      ArSerializer::GraphQL::SchemaClass.new self.class
    end
  end

  module ApiControllerConcern
    extend ActiveSupport::Concern

    included do
      protect_from_forgery except: %i[sync_call static_call graphql_call]
    end

    def schema
      raise 'you must implement method `schema`'
    end

    def sync_call
      _api_call :sync do |model, current_user, query|
        ArSync.sync_serialize model, current_user, query
      end
    end

    def graphql_schema
      render plain: ArSerializer::GraphQL.definition(schema.class)
    end

    def graphql_call
      render json: ArSerializer::GraphQL.serialize(
        schema,
        params[:query],
        operation_name: params[:operationName],
        variables: (params[:variables] || {}).as_json,
        context: current_user
      )
    rescue StandardError => e
      render json: { error: handle_exception(e) }
    end

    def static_call
      _api_call :static do |model, current_user, query|
        case model
        when ArSync::Collection, ActiveRecord::Relation, Array
          ArSerializer.serialize model.to_a, query, context: current_user
        when ArSerializer::Serializable
          ArSerializer.serialize model, query, context: current_user
        else
          model
        end
      end
    end

    private

    def _api_call(type)
      if respond_to?(ArSync.config.current_user_method)
        current_user = send ArSync.config.current_user_method
      end
      responses = params[:requests].map do |request|
        begin
          api_name = request[:api]
          sch = schema
          info = sch.class._serializer_field_info api_name
          raise ArSync::ApiNotFound, "#{type.to_s.capitalize} API named `#{api_name}` not configured" unless info
          api_params = (request[:params].as_json || {}).transform_keys(&:to_sym)
          model = sch.instance_exec(current_user, api_params, &info.data_block)
          { data: yield(model, current_user, request[:query].as_json) }
        rescue StandardError => e
          { error: handle_exception(e) }
        end
      end
      render json: responses
    end

    def log_internal_exception_trace(trace)
      if logger.formatter&.respond_to? :tags_text
        logger.fatal trace.join("\n#{logger.formatter.tags_text}")
      else
        logger.fatal trace.join("\n")
      end
    end

    def exception_trace(exception)
      backtrace_cleaner = request.get_header 'action_dispatch.backtrace_cleaner'
      wrapper = ActionDispatch::ExceptionWrapper.new backtrace_cleaner, exception
      trace = wrapper.application_trace
      trace.empty? ? wrapper.framework_trace : trace
    end

    def log_internal_exception(exception)
      ActiveSupport::Deprecation.silence do
        logger.fatal '  '
        logger.fatal "#{exception.class} (#{exception.message}):"
        log_internal_exception_trace exception.annoted_source_code if exception.respond_to?(:annoted_source_code)
        logger.fatal '  '
        log_internal_exception_trace exception_trace(exception)
      end
    end

    def handle_exception(exception)
      log_internal_exception exception
      backtrace = exception_trace exception unless ::Rails.env.production?
      case exception
      when ArSerializer::InvalidQuery, ArSync::ApiNotFound, ArSerializer::GraphQL::Parser::ParseError
        { type: 'Bad Request', message: exception.message, backtrace: backtrace }
      when ActiveRecord::RecordNotFound
        message = exception.message unless ::Rails.env.production?
        { type: 'Record Not Found', message: message.to_s, backtrace: backtrace }
      else
        message = "#{exception.class} (#{exception.message})" unless ::Rails.env.production?
        { type: 'Internal Server Error', message: message.to_s, backtrace: backtrace }
      end
    end
  end
end
