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

  def test_ts_data_type
    tests = <<~TYPESCRIPT
      import { DataTypeFromRequest } from '../src/DataType'
      type DataTypeFromRequestInstance<R extends TypeRequest> = DataTypeFromRequest<ApiNameRequests[R['api']], R>
      const data1 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: 'id' }>)
      data1.id
      const data2 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: ['id', 'name'] }>)
      data2.id; data2.name
      const data3 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: '*' }>)
      data3.id; data3.name; data3.posts
      const data4 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser';  query: { posts: 'id' } }>)
      data4.posts[0].id
      const data5 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: { posts: '*' } }>)
      data5.posts[0].id; data5.posts[0].user; data5.posts[0].body
      const data6 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: { posts: { '*': true, comments: 'user' } } }>)
      data6.posts[0].id; data6.posts[0].user; data6.posts[0].comments[0].user
      const data7 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: { name: true, poosts: true } }>)
      data7.error.extraFields
      const data8 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: { posts: { id: true, commmments: true, titllle: true } } }>)
      data8.error.extraFields
      const data9 = ({} as DataTypeFromRequestInstance<{ api: 'currentUser'; query: { '*': true, posts: { id: true, commmments: true } } }>)
      data9.error.extraFields
    TYPESCRIPT
    File.write 'test/generated_type_test.ts', [
      ArSync::TypeScript.generate_type_definition(Schema),
      tests
    ].join("\n")
    output = `./node_modules/typescript/bin/tsc --noEmit test/generated_type_test.ts`
    puts output
    assert output.empty?
  end
end
