require 'json'

class TestRunner
  def initialize(schema, current_user)
    Dir.chdir File.dirname(__FILE__) do
      @io = IO.popen 'node test_runner.js', 'w+'
    end
    @eval_responses = {}
    @schema = schema
    @current_user = current_user
  end

  def configure
    ArSync.on_notification do |events|
      events.each do |key, patch|
        notify key, patch
      end
    end
  end

  def handle_requests(requests)
    requests.map do |request|
      api_name = request['api']
      info = @schema._serializer_field_info api_name
      api_params = (request['params'] || {}).transform_keys(&:to_sym)
      model = instance_exec(@current_user, api_params, &info.data_block)
      { data: serialize(model, @current_user, request['query']) }
    end
  end

  def serialize(model, query)
    case model
    when ArSync::Collection::Graph, ArSync::GraphSync
      serialized = ArSerializer.serialize model, query, context: @current_user, include_id: true, use: :sync
      next serialized if model.is_a? ArSync::GraphSync
      {
        sync_keys: ArSync.sync_graph_keys(model, @current_user),
        order: { mode: model.order, limit: model.limit },
        collection: serialized
      }
    when ArSync::Collection::Tree
      ArSync.sync_collection_api model, @current_user, query
    when ActiveRecord::Relation, Array
      ArSync.serialize model.to_a, query, user: @current_user
    when ActiveRecord::Base
      ArSync.sync_api model, @current_user, query
    when ArSerializer::Serializable
      ArSync.serialize model, query, user: @current_user
    else
      model
    end
  end

  def start
    configure
    Thread.new { _run }
  end

  def _run
    while data = @io.gets
      begin
        e = JSON.parse data
        case e['type']
        when 'result'
          @eval_responses[e['key']]&.<< e
        when 'request'
          response = handle_requests e['data']
          @io.puts({ type: :response, key: e['key'], data: response }.to_json)
        end
      rescue => e
        puts e
      end
    end
  end

  def eval_script(code)
    key = rand
    @io.puts({ type: :eval, key: key, data: code }.to_json)
    queue = @eval_responses[key] = Queue.new
    output = queue.deq
    @eval_responses.delete key
    raise output['error'] if output['error']
    output['result']
  end

  def notify(key, data)
    @io.puts({ type: :notify, key: key, data: data }.to_json)
  end
end

require 'pry'
binding.pry
