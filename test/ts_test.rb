require 'minitest/autorun'
require 'ar_sync'
require_relative 'model'

class TsTest < Minitest::Test
  class Schema
    include ArSerializer::Serializable
    serializer_field :currentUser, type: User
    serializer_field :users, type: [User]
    serializer_field 'User', type: [User], params_type: { ids: [:int] }
  end

  def test_ts_type_generate
    ArSync::TypeScript.generate_type_definition User
  end

  def test_typed_files
    dir = 'test/generated_typed_files'
    Dir.mkdir dir unless Dir.exist? dir
    ArSync::TypeScript.generate_typed_files Schema, dir: dir
    %w[ArSyncApi.ts ArSyncModel.ts DataTypeFromRequest.ts hooks.ts].each do |file|
      path = File.join dir, file
      File.write path, File.read(path).gsub('ar_sync/', '../../src/')
    end
    output = `./node_modules/typescript/bin/tsc --strict --lib es2017 --noEmit test/type_test.ts`
    output = output.lines.grep(/type_test/)
    puts output
    assert output.empty?

    output = `./node_modules/typescript/bin/tsc --lib es2017,dom --noEmit test/generated_typed_files/*.ts`
    puts output
    assert output.empty?
  end
end
