module ArSync::TypeScript
  def self.generate_typed_files(api_class, dir:, mode: nil)
    mode ||= :graph if ActiveRecord::Base.include? ArSync::GraphSync
    mode ||= :tree if ActiveRecord::Base.include? ArSync::TreeSync
    {
      'types.ts' => generate_type_definition(api_class),
      'ArSyncModel.ts' => generate_model_script(mode)
    }.each { |file, code| File.write File.join(dir, file), code }
  end

  def self.generate_type_definition(api_class)
    [
      ArSerializer::TypeScript.generate_type_definition(api_related_classes(api_class)),
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
      prefix = 'Class' if field.name.match? /\A[A-Z]/ # for class reload query
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

  def self.generate_model_script(mode)
    <<~CODE
      import { TypeRequest, ApiNameRequests } from './types'
      import { DataTypeFromRequest } from 'ar_sync/DataType'
      import ArSyncModelBase from 'ar_sync/#{mode}'
      export default class ArSyncModel<R extends TypeRequest> extends ArSyncModelBase<{}> {
        constructor(r: R) { super(r) }
        data: DataTypeFromRequest<ApiNameRequests[R['api']], R> | {} | null
      }
    CODE
  end
end
