require 'json'

class TestRunner
  def initialize(schema, current_user)
    Dir.chdir File.dirname(__FILE__) do
      @io = IO.popen 'node test_runner.js', 'w+'
    end
    @eval_responses = {}
    @schema = schema
    @current_user = current_user
    configure
    start
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
      info = @schema.class._serializer_field_info api_name
      api_params = (request['params'] || {}).transform_keys(&:to_sym)
      model = instance_exec(@current_user, api_params, &info.data_block)
      { data: serialize(model,request['query']) }
    end
  end

  def serialize(model, query)
    case model
    when ArSync::Collection::Graph, ArSync::GraphSync
      serialized = ArSerializer.serialize model, query, context: @current_user, include_id: true, use: :sync
      return serialized if model.is_a? ArSync::GraphSync
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
    Thread.new { _run }
  end

  def _run
    while data = @io.gets
      begin
        e = JSON.parse data rescue nil
        type = e.is_a?(Hash) && e['type']
        case type
        when 'result'
          @eval_responses[e['key']]&.<< e
        when 'request'
          p request: e['data']
          response = handle_requests e['data']
          @io.puts({ type: :response, key: e['key'], data: response }.to_json)
        else
          puts data
        end
      rescue => e
        puts e
        puts e.backtrace
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

  def assert_script(code, to_be: :unset, not_to_be: :unset, timeout: 1, &block)
    start = Time.now
    raise if [to_be != :unset, not_to_be != :unset, block].count(&:itself) >= 2
    blocks = [*block]
    blocks << -> v { v == to_be } if to_be != :unset
    blocks << -> v { v != not_to_be } if not_to_be != :unset
    raise ArgumentError if blocks.size >= 2
    block = blocks.first || -> v { v != nil }
    return if block.call eval_script(code)
    loop do
      sleep [timeout, 0.05].min
      result = eval_script(code)
      return if block.call result
      raise "Assert failed: #{result}" if Time.now - start > timeout
    end
  end

  def notify(key, data)
    @io.puts({ type: :notify, key: key, data: data }.to_json)
  end
end
