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
      user = @current_user.reload
      query = {
        request['api'] => {
          as: :data,
          params: request['params'],
          attributes: request['query']
        }
      }
      begin
        ArSync.sync_serialize @schema, user, query
      rescue ActiveRecord::RecordNotFound => e
        { error: { type: 'Record Not Found', message: e.message } }
      end
    end
  end

  def start
    Thread.new { _run }
  end

  def _run
    while data = @io.gets
      begin
        e = JSON.parse data rescue nil
        type = e.is_a?(Hash) && e['__test_runner_type']
        case type
        when 'result'
          @eval_responses[e['key']] << e
        when 'request'
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
    queue = @eval_responses[key] = Queue.new
    @io.puts({ type: :eval, key: key, data: code }.to_json)
    output = queue.deq
    @eval_responses.delete key
    raise output['error'] if output['error']
    output['result']
  end

  def assert_script(code, **options, &block)
    timeout = options.has_key?(:timeout) ? options.delete(:timeout) : 1
    start = Time.now

    if options.empty?
      block ||= :itself.to_proc
    else
      block = lambda do |v|
        options.all? do |key, value|
          /^(?<reversed>not_)?to_(?<verb>.+)/ =~ key
          result = verb == 'be' ? v == value : v.send(verb + '?', value)
          reversed ? !result : result
        end
      end
    end
    return true if block.call eval_script(code)
    loop do
      sleep [timeout, 0.05].min
      result = eval_script code
      return true if block.call result
      raise "Assert failed: #{result.inspect} #{options unless options.empty?}" if Time.now - start > timeout
    end
  end

  def notify(key, data)
    @io.puts({ type: :notify, key: key, data: data }.to_json)
  end
end
