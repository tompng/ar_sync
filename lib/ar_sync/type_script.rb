module ArSync::TypeScript
  def self.generate_type_definition(api_class)
    [
      ArSerializer::TypeScript.generate_type_definition(api_related_classes(api_class)),
      request_type_definition(api_class)
    ].join "\n"
  end

  def self.generate_query_builder(api_class)
    ArSerializer::TypeScript.generate_query_builder api_related_classes(api_class)
  end

  def self.api_related_classes(api_class)
    ArSerializer::TypeScript.all_related_classes([api_class]) - [api_class]
  end

  def self.request_type_definition(api_class)
    type = ArSerializer::GraphQL::TypeClass.from api_class
    definitions = []
    request_type_names = []
    type.fields.each do |field|
      association_type = field.type.association_type
      next unless association_type
      prefix = 'Class' if field.name.match? /\A[A-Z]/ # for class reload query
      request_type_name = "SyncApi#{prefix}#{field.name.camelize}Request"
      request_type_names << request_type_name
      definitions << <<~CODE
        export interface #{request_type_name} {
          api: '#{field.name}'
          params?: #{field.args_ts_type}
          query: Type#{association_type.name}Query
        }
      CODE
    end
    [
      "export type SyncApiRequest = #{request_type_names.join ' | '}",
      *definitions
    ].join("\n")
  end
end
