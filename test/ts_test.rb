require 'minitest/autorun'
require 'ar_sync'
require_relative 'model_tree'
require_relative 'model_graph'


class TsTest < Minitest::Test
  def test_ts_type_generate
    type_tree = ArSync::TypeScript.generate_type_definition Tree::User
    type_graph = ArSync::TypeScript.generate_type_definition Graph::User
    assert !type_tree.include?('::')
    assert !type_graph.include?('::')
  end

  def test_ts_query_builder_generate
    qb_tree = ArSync::TypeScript.generate_query_builder Tree::User
    qb_graph = ArSync::TypeScript.generate_query_builder Graph::User
    assert !qb_tree.include?('::')
    assert !qb_graph.include?('::')
  end
end
