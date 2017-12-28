module ARSync
  extend ActiveSupport::Concern

  class Collection < Struct.new(:klass, :name); end

  module ClassMethods
    def sync_has_data(*names, **option, &data_block)
      _sync_define(:data, names, option, &data_block)
    end

    def sync_has_one(*names, **option, &data_block)
      _sync_define(:one, names, option, &data_block)
    end

    def sync_has_many(*names, **option, &data_block)
      _sync_define(:many, names, option, &data_block)
    end

    def _sync_define(type, names, option, &data_block)
      names.each do |name|
        _sync_children_type[name] = type
        block = data_block || ->(*_preloads) { send name }
        preloadable "#{_sync_}name", option, &block
        # preloadable name, option, &block # define for static api
      end
    end

    def sync_self
      _initialize_sync_callbacks
      @_sync_self = true
    end

    def sync_parent(parent, inverse_of:, only_to: nil)
      _initialize_sync_callbacks
      _sync_parents_info << [
        parent,
        { inverse_name: inverse_of, only_to: only_to }
      ]
    end

    def sync_define_collection(name, limit: nil, order: :asc)
      _initialize_sync_callbacks
      _sync_collection_info[name] = { limit: limit, order: order }
    end

    def sync_collection(name)
      unless _sync_collection_info.key? name
        raise "No such collection `#{name}` defined in `#{self}`"
      end
      Collection.new self, name
    end

    def _sync_self?
      instance_variable_defined? '@_sync_self'
    end

    def _sync_collection_info
      @_sync_collection_info ||= {}
    end

    def _sync_parents_info
      @_sync_parents_info ||= []
    end

    def _sync_children_type
      @_sync_children_type ||= {}
    end

    def _initialize_sync_callbacks
      return if instance_variable_defined? '@_sync_callbacks_initialized'
      sync_has_data :id
      @_sync_callbacks_initialized = true
      %i[create update destroy].each do |action|
        after_commit on: action do
          self.class.default_scoped.scoping { _sync_notify action }
        end
      end
    end
  end

  included do
    include ARPreload
  end

  def _sync_notify(action)
    if self.class._sync_self?
      ARSync.sync_send to: self, action: action, path: [], data: _sync_data
    end
    _sync_notify_parent action
  end

  def _sync_data(names = nil, to_user: nil, new_record: false)
    fallbacks = {}
    unless names
      names = []
      self.class._sync_children_type.each do |name, type|
        names << name if type == :data
        if new_record
          fallbacks[name] = [] if type == :many
          fallbacks[name] = nil if type == :one
        end
      end
    end
    data = ARPreload::Serializer.serialize self, *names, context: to_user, prefix: '_sync_'
    fallbacks.update data
  end

  def _sync_notify_collection(action, path:, data:, only_to_user:)
    self.class._sync_collection_info.each do |name, order:, limit:|
      collenction = Collection.new self.class, name
      ids = self.class.order(id: order).limit(limit).pluck(:id) if limit
      if path
        if !limit || ids.include?(id)
          ARSync.sync_send(
            to: collenction,
            action: action,
            path: [id, *path],
            data: data,
            to_user: only_to_user
          )
        end
        next
      end
      if action == :destroy
        if limit && ids.size == limit
          next if order == :asc && ids.max < id
          next if order == :desc && id < ids.min
        end
        ARSync.sync_send(
          to: collenction,
          action: :destroy,
          data: nil,
          path: [id],
          to_user: only_to_user
        )
      elsif !limit || ids.include?(id)
        ARSync.sync_send(
          to: collenction,
          action: action,
          data: data || _sync_data(new_record: action == :create),
          path: [id],
          to_user: only_to_user
        )
      end
    end
  end

  def _sync_notify_parent(action, path: nil, data: nil, only_to_user: nil)
    _sync_notify_collection(action, path: path, data: data, only_to_user: only_to_user)
    self.class._sync_parents_info.each do |parent_name, inverse_name:, only_to:|
      if only_to
        to_user = instance_exec(&only_to)
        next unless to_user
        next if only_to_user && only_to_user != to_user
      end
      parent = send parent_name
      next unless parent
      type = parent.class._sync_children_type[inverse_name]
      action2 = action
      if type == :many
        data2 = path ? data : _sync_data(new_record: action == :create)
        path2 = [inverse_name, id, *path]
      elsif path
        data2 = data
        path2 = [inverse_name, *path]
      else
        if type == :data
          action2 = :update
          data2 = parent._sync_data([inverse_name], to_user: to_user)
          path2 = []
        else
          data2 = _sync_data
          path2 = [inverse_name]
        end
      end
      ARSync.sync_send to: parent, action: action2, path: path2, data: data2, to_user: to_user || only_to_user
      parent._sync_notify_parent action2, path: path2, data: data2, only_to_user: to_user || only_to_user
    end
  end

  def self.on_update(&block)
    @sync_send_block = block
  end

  self.on_update do end

  def self.sync_send(to:, action:, path:, data:, to_user: nil)
    key = sync_key to, path.grep(Symbol), to_user
    @sync_send_block&.call key: key, action: action, path: path, data: data
  end

  def self.sync_key(model, path, to_user = nil)
    if model.is_a? ARSync::Collection
      key = [to_user&.id, model.klass.name, model.name, path].join '/'
    else
      key = [to_user&.id, model.class.name, model.id, path].join '/'
    end
    key = Digest::SHA256.hexdigest "#{config.key_secret}#{key}" if config.key_secret
    "#{config.key_prefix}#{key}"
  end

  def self.sync_collection_api(collection, current_user, *args)
    paths = _extract_paths args
    keys = paths.flat_map do |path|
      [sync_key(collection, path), sync_key(collection, path, current_user)]
    end
    info = collection.klass._sync_collection_info[collection.name]
    records = collection.klass.order(id: info[:order]).limit(info[:limit])
    {
      keys: keys,
      limit: info[:limit],
      order: info[:order],
      data: ARPreload::Serializer.serialize(records.to_a, *args, context: current_user, include_id: true)
    }
  end

  def self.sync_api(model, current_user, *args)
    paths = _extract_paths args
    keys = paths.flat_map do |path|
      [sync_key(model, path), sync_key(model, path, current_user)]
    end
    {
      keys: keys,
      data: ARPreload::Serializer.serialize(model, *args, context: current_user, include_id: true, prefix: '_sync_')
    }
  end

  def self._extract_paths(args)
    parsed = ARPreload::Serializer.parse_args args
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
    ARPreload::Serializer.serialize record_or_records, *query, context: current_user
  end
end
