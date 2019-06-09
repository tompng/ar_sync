require 'minitest/autorun'
require 'ar_sync'
require_relative 'model_tree'
require_relative 'model_graph'

class TsTest < Minitest::Test
  class Schema
    include ArSerializer::Serializable
    serializer_field :currentUser, type: Tree::User
    serializer_field :users, type: [Tree::User]
  end

  def test_ts_type_generate
    type_tree = ArSync::TypeScript.generate_type_definition Tree::User
    type_graph = ArSync::TypeScript.generate_type_definition Graph::User
    assert !type_tree.include?('::')
    assert !type_graph.include?('::')
  end

  def test_typed_files
    dir = 'test/generated_typed_files'
    Dir.mkdir dif unless Dir.exist? dir
    ArSync::TypeScript.generate_typed_files Schema, mode: :tree, dir: dir
    ['hooks.ts', 'ArSyncModel.ts', 'types.ts'].each do |file|
      path = File.join dir, file
      File.write path, File.read(path).gsub('ar_sync/', '../../src/')
    end
    output = `./node_modules/typescript/bin/tsc --strict --lib es2017 --noEmit test/type_test.ts`
    output = output.lines.grep(/test/)
    puts output
    assert output.empty?
  end
end
