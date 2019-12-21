module ArSync::TypeScript
  def self.generate_typed_files(api_class, dir:, comment: nil)
    {
      'types.ts' => generate_type_definition(api_class),
      'ArSyncModel.ts' => generate_model_script,
      'ArSyncApi.ts' => generate_api_script,
      'hooks.ts' => generate_hooks_script,
      'DataTypeFromRequest.ts' => generate_type_util_script
    }.each { |file, code| File.write File.join(dir, file), "#{comment}#{code}" }
  end

  def self.generate_type_definition(api_class)
    classes = api_related_classes api_class
    types = ArSerializer::TypeScript.related_serializer_types classes.flatten
    [
      types.map { |t| data_type_definition t },
      types.map { |t| query_type_definition t },
      request_type_definition(api_class)
    ].join "\n"
  end

  def self.api_related_classes(api_class)
    classes = ArSerializer::TypeScript.related_serializer_types([api_class]).map(&:type)
    classes - [api_class]
  end

  def self.request_type_definition(api_class)
    type = ArSerializer::GraphQL::TypeClass.from api_class
    definitions = []
    request_types = {}
    type.fields.each do |field|
      association_type = field.type.association_type
      next unless association_type
      prefix = 'Class' if field.name.match?(/\A[A-Z]/) # for class reload query
      request_type_name = "Type#{prefix}#{field.name.camelize}Request"
      request_types[field.name] = request_type_name
      multiple = field.type.is_a? ArSerializer::GraphQL::ListTypeClass
      definitions << <<~CODE
        export interface #{request_type_name} {
          api: '#{field.name}'
          params?: #{field.args_ts_type}
          query: Type#{association_type.name}Query
          _meta?: { data: Type#{field.type.association_type.name}#{'[]' if multiple} }
        }
      CODE
    end
    [
      'export type TypeRequest = ',
      request_types.values.map { |value| "  | #{value}" },
      'export type ApiNameRequests =  {',
      request_types.map { |key, value| "  #{key}: #{value}" },
      '}',
      definitions
    ].join("\n")
  end

  def self.generate_model_script
    <<~CODE
      import { TypeRequest } from './types'
      import DataTypeFromRequest from './DataTypeFromRequest'
      import { default as ArSyncModelBase } from 'ar_sync/core/ArSyncModel'
      declare class ArSyncModel<R extends TypeRequest> extends ArSyncModelBase<DataTypeFromRequest<R>> {
        constructor(r: R, option?: { immutable: boolean })
      }
      export default ArSyncModelBase as typeof ArSyncModel
    CODE
  end

  def self.generate_api_script
    <<~CODE
      import { TypeRequest } from './types'
      import DataTypeFromRequest from './DataTypeFromRequest'
      import ArSyncApi from 'ar_sync/core/ArSyncApi'
      export function fetch<R extends TypeRequest>(request: R) {
        return ArSyncApi.fetch(request) as Promise<DataTypeFromRequest<R>>
      }
    CODE
  end

  def self.generate_type_util_script
    <<~CODE
      import { TypeRequest, ApiNameRequests } from './types'
      import { DataTypeFromRequest as DataTypeFromRequestPair } from 'ar_sync/core/DataType'
      type DataTypeFromRequest<R extends TypeRequest> = DataTypeFromRequestPair<ApiNameRequests[R['api']], R>
      export default DataTypeFromRequest
    CODE
  end

  def self.generate_hooks_script
    <<~CODE
      import { useState, useEffect, useMemo } from 'react'
      import { TypeRequest } from './types'
      import DataTypeFromRequest from './DataTypeFromRequest'
      import { initializeHooks, useArSyncModel as useArSyncModelBase, useArSyncFetch as useArSyncFetchBase } from 'ar_sync/core/hooks'
      initializeHooks({ useState, useEffect, useMemo })
      export function useArSyncModel<R extends TypeRequest>(request: R | null) {
        return useArSyncModelBase<DataTypeFromRequest<R>>(request)
      }
      export function useArSyncFetch<R extends TypeRequest>(request: R | null) {
        return useArSyncFetchBase<DataTypeFromRequest<R>>(request)
      }
    CODE
  end

  def self.query_type_definition(type)
    field_definitions = type.fields.map do |field|
      association_type = field.type.association_type
      if association_type
        qname = "Type#{association_type.name}Query"
        if field.args.empty?
          "#{field.name}?: true | #{qname} | { as?: string; attributes?: #{qname} }"
        else
          "#{field.name}?: true | #{qname} | { as?: string; params: #{field.args_ts_type}; attributes?: #{qname} }"
        end
      else
        "#{field.name}?: true | { as: string }"
      end
    end
    field_definitions << "'*'?: true"
    query_type_name = "Type#{type.name}Query"
    base_query_type_name = "Type#{type.name}QueryBase"
    <<~TYPE
      export type #{query_type_name} = keyof (#{base_query_type_name}) | Readonly<(keyof (#{base_query_type_name}))[]> | #{base_query_type_name}
      export interface #{base_query_type_name} {
      #{field_definitions.map { |line| "  #{line}" }.join("\n")}
      }
    TYPE
  end

  def self.data_type_definition(type)
    field_definitions = []
    type.fields.each do |field|
      field_definitions << "#{field.name}: #{field.type.ts_type}"
    end
    field_definitions << "_meta?: { name: '#{type.name}'; query: Type#{type.name}QueryBase }"
    <<~TYPE
      export interface Type#{type.name} {
      #{field_definitions.map { |line| "  #{line}" }.join("\n")}
      }
    TYPE
  end
end
