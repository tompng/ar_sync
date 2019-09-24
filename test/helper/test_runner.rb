require 'json'

class TestRunner
  def initialize(&block)
    Dir.chdir File.dirname(__FILE__) do
      @io = IO.popen 'node test_runner.js', 'w+'
    end
    @eval_responses = {}
    @onrequest = block
  end

  def configure
    ArSync.on_notification do |events|
      events.each do |key, patch|
        notify key, patch
      end
    end
  end

  def start
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
          response = @onrequest.call e['data']
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
