require 'ar_serializer'
require_relative 'field'
require_relative 'collection'
require_relative 'class_methods'
require_relative 'instance_methods'

module ArSync
  extend ActiveSupport::Concern
  include ArSync::InstanceMethods

  def self.on_update(&block)
    @sync_send_block = block
  end

  self.on_update do end

  def self.sync_send(to:, action:, path:, data:, to_user: nil, ordering: nil)
    key = sync_key to, path.grep(Symbol), to_user
    @sync_send_block&.call key, action: action, path: path, data: data, ordering: ordering
  end

  def self.sync_key(model, path, to_user = nil)
    if model.is_a? ArSync::Collection
      key = [to_user&.id, model.klass.name, model.name, path].join '/'
    else
      key = [to_user&.id, model.class.name, model.id, path].join '/'
    end
    key = Digest::SHA256.hexdigest "#{config.key_secret}#{key}" if config.key_secret
    "#{config.key_prefix}#{key}"
  end

  def self.sync_collection_api(collection, current_user, args)
    paths = _extract_paths args
    keys = paths.flat_map do |path|
      [sync_key(collection, path), sync_key(collection, path, current_user)]
    end
    {
      keys: keys,
      data: ArSerializer.serialize(collection.to_a, args, context: current_user, include_id: true, use: :sync)
    }
  end

  def self.sync_api(model, current_user, args)
    paths = _extract_paths args
    keys = paths.flat_map do |path|
      [sync_key(model, path), sync_key(model, path, current_user)]
    end
    {
      keys: keys,
      data: ArSerializer.serialize(model, args, context: current_user, include_id: true, use: :sync)
    }
  end

  def self._extract_paths(args)
    parsed = ArSerializer::Serializer.parse_args args
    paths = []
    extract = lambda do |path, attributes|
      paths << path
      attributes.each do |key, value|
        sub_attributes = value[:attributes]
        next unless sub_attributes
        sub_path = [*path, key]
        extract.call sub_path, sub_attributes
      end
    end
    extract.call [], parsed[:attributes]
    paths
  end

  def self.serialize(record_or_records, current_user = nil, query)
    ArSerializer.serialize record_or_records, query, context: current_user
  end
end
