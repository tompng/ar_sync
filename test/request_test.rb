require 'minitest/autorun'
require 'ar_sync'
module Rails; class Engine; end; end
module ActionController
  class Base
    def self.protect_from_forgery(*); end
    def self.around_action(*); end
  end
end
require 'ar_sync/rails'

class TsTest < Minitest::Test
  PARAMS_TYPE = { fooId: :int, bar: { bazId: :int } }
  class Model
    def self.after_initialize(*, &); end
    def self.before_destroy(*, &); end
    def self.after_commit(*, &); end
    include ArSerializer::Serializable
    include ArSync::ModelBase
    def self.validate!(foo_id, bar)
      raise unless foo_id.is_a?(Integer) && bar[:baz_id].is_a?(Integer)
    end
    serializer_field :model1, type: Model, params_type: PARAMS_TYPE do |_user, foo_id:, bar:|
      Model.validate! foo_id, bar
      Model.new
    end
    sync_has_one :model2, type: Model, params_type: PARAMS_TYPE do |_user, foo_id:, bar:|
      Model.validate! foo_id, bar
      Model.new
    end
    def id; 1; end
  end

  class Schema
    include ArSerializer::Serializable
    serializer_field :model, type: Model, params_type: PARAMS_TYPE do |_user, foo_id:, bar:|
      Model.validate! foo_id, bar
      Model.new
    end
    serializer_field :hash do
      { x: 0, y: 0 }
    end
  end

  class Controller < ActionController::Base
    include ArSync::ApiControllerConcern

    attr_reader :params, :result, :schema, :current_user

    def initialize(request_params)
      @params = request_params
      @schema = Schema.new
      @current_user = nil
    end

    def log_internal_exception(e)
      raise e
    end

    def render(result)
      @result = result
    end
  end

  def test_rails_api_response
    params = { fooId: 1, bar: { bazId: 2 } }
    requests = [
      {
        api: :model,
        params: params,
        query: {
          id: true,
          model1: { params: params, attributes: :id },
          model2: { params: params, attributes: :id }
        }
      },
      { api: :hash, query: {} }
    ]
    expected = { json: [{ data: { id: 1, model1: { id: 1 }, model2: { id: 1 } } }, { data: { x: 0, y: 0 } }] }
    assert_equal expected, Controller.new({ requests: requests }).tap(&:static_call).result
  end
end
