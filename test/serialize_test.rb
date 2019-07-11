require 'minitest/autorun'
require 'ar_sync'
require_relative 'model_tree'
require_relative 'model_graph'

class SerializeTest < Minitest::Test
  def test_sync_serialize
    tree_data = ArSerializer.serialize Tree::User.first, posts: :id
    graph_data = ArSerializer.serialize Graph::User.first, posts: :id
    assert_equal tree_data, graph_data
  end

  def test_static_serialize
    tree_data = ArSync.serialize Tree::User.first, posts: :id
    graph_data = ArSync.serialize Graph::User.first, posts: :id
    assert tree_data != graph_data
  end
end
