module ArSync::TypeScript
  def self.generate_typed_files(api_class, dir:, mode: nil, comment: nil)
    mode ||= :graph if ActiveRecord::Base.include? ArSync::GraphSync
    mode ||= :tree if ActiveRecord::Base.include? ArSync::TreeSync
    raise 'ar_sync mode: graph or tree, is not specified.' unless mode
    {
      'types.ts' => generate_type_definition(api_class),
      'ArSyncModel.ts' => generate_model_script(mode),
      'hooks.ts' => generate_hooks_script(mode)
    }.each { |file, code| File.write File.join(dir, file), "#{comment}#{code}" }
  end

  def self.generate_type_definition(api_class)
    schema = Class.new
    schema.define_singleton_method(:name) { 'Schema' }
    schema.define_singleton_method(:ancestors) { api_class.ancestors }
    schema.define_singleton_method(:method_missing) { |*args| api_class.send(*args) }
    classes = [schema] + api_related_classes(api_class) - [api_class]
    [
      "import { DataTypeFromQueryPair } from 'ar_sync/core/DataType'",
      ArSerializer::TypeScript.generate_type_definition(classes),
      <<~CODE
      type ExtractData<T> = T extends { data: infer D } ? D : T
      export type DataTypeFromRootQuery<Q extends TypeSchemaAliasFieldQuery> =
        ExtractData<DataTypeFromQueryPair<TypeSchema, { data: Q }>>
        export type TypeRootQuery = TypeSchemaAliasFieldQuery
      CODE
    ].join "\n"
  end

  def self.api_related_classes(api_class)
    ArSerializer::TypeScript.related_serializer_types([api_class]).map(&:type)
  end

  def self.generate_model_script(mode)
    <<~CODE
      import { TypeSchema, TypeRootQuery, DataTypeFromRootQuery } from './types'
      import ArSyncModelBase from 'ar_sync/#{mode}/ArSyncModel'
      export default class ArSyncModel<Q extends TypeRootQuery> extends ArSyncModelBase<DataTypeFromRootQuery<Q>> {
        constructor(q: Q) { super(q) }
      }
    CODE
  end

  def self.generate_hooks_script(mode)
    <<~CODE
      import { TypeSchema, TypeRootQuery, DataTypeFromRootQuery } from './types'
      import { useArSyncModel as useArSyncModelBase, useArSyncFetch as useArSyncFetchBase } from 'ar_sync/#{mode}/hooks'
      export function useArSyncModel<Q extends TypeRootQuery>(request: Q | null) {
        return useArSyncModelBase<DataTypeFromRootQuery<Q>>(request)
      }
      export function useArSyncFetch<Q extends TypeRootQuery>(request: Q | null) {
        return useArSyncFetchBase<DataTypeFromRootQuery<Q>>(request)
      }
    CODE
  end
end
