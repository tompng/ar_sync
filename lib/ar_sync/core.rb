require 'ar_serializer'
require_relative 'collection'
require_relative 'class_methods'
require_relative 'instance_methods'

module ArSync
  ArSync::TreeSync.module_eval do
    extend ActiveSupport::Concern
    include ArSync::TreeSync::InstanceMethods
  end

  ArSync::GraphSync.module_eval do
    extend ActiveSupport::Concern
    include ArSync::GraphSync::InstanceMethods
  end

  def self.on_notification(&block)
    @sync_send_block = block
  end

  def self.with_compact_notification
    key = :ar_sync_compact_notifications
    Thread.current[key] = []
    yield
  ensure
    events = Thread.current[key]
    Thread.current[key] = nil
    @sync_send_block&.call events if events.present?
  end

  def self.skip_notification?
    Thread.current[:ar_sync_skip_notification]
  end

  def self.without_notification
    key = :ar_sync_skip_notification
    flag_was = Thread.current[key]
    Thread.current[key] = true
    yield
  ensure
    Thread.current[key] = flag_was
  end

  def self.sync_tree_send(to:, action:, path:, data:, to_user: nil, ordering: nil)
    key = sync_key to, path.grep(Symbol), to_user
    event = [key, action: action, path: path, data: data, ordering: ordering]
    buffer = Thread.current[:ar_sync_compact_notifications]
    if buffer
      buffer << event
    else
      @sync_send_block&.call [event]
    end
  end

  def self.sync_graph_send(to:, action:, model:, path: nil, to_user: nil)
    key = sync_graph_key to, to_user
    event = ["#{key}#{path}", action: action, class_name: model.class.base_class.name, id: model.id]
    buffer = Thread.current[:ar_sync_compact_notifications]
    if buffer
      buffer << event
    else
      @sync_send_block&.call [event]
    end
  end

  def self.sync_graph_key(model, to_user = nil)
    sync_key(model, :graph_sync, to_user) + '/'
  end

  def self.sync_graph_keys(model, user)
    [sync_graph_key(model), sync_graph_key(model, user)]
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
      data: serialize(collection.to_a, args, user: current_user)
    }
  end

  def self.sync_api(model, current_user, args)
    paths = _extract_paths args
    keys = paths.flat_map do |path|
      [sync_key(model, path), sync_key(model, path, current_user)]
    end
    {
      keys: keys,
      data: serialize(model, args, user: current_user)
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

  def self.serialize(record_or_records, query, user: nil)
    ArSerializer.serialize record_or_records, query, context: user, include_id: true, use: :sync
  end
end
