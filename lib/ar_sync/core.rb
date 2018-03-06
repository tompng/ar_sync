require 'ar_serializer'
require_relative 'field'

module ARSync
  extend ActiveSupport::Concern

  class Collection < Struct.new(:klass, :name)
    def info
      @info ||= klass._sync_collection_info[name]
    end
    def to_a
      klass.order(id: info[:order]).limit(info[:limit]).to_a
    end
  end

  class CollectionInfo
    attr_reader :klass, :name, :limit, :order
    def initialize(klass, name, limit: nil, order: nil)
      @klass = klass
      @name = name
      @limit = limit
      @order = order
      self.class._sync_children_info[:records] = HasManyField.new name, limit: limit, order: order
      define_singleton_method name do
        all = klass.all
        all = all.order id: order if order
        all = all.limit limit if limit
        all
      end
    end
    def _sync_notify_parent*; end
  end

  module ClassMethods
    def sync_has_data(*names, **option, &original_data_block)
      if original_data_block
        data_block = ->(*args) { instance_exec(*args, &original_data_block).as_json }
      end
      names.each do |name|
        _sync_define(DataField.new(name), option, &data_block)
      end
    end

    def api_has_field(*args, &data_block)
      serializer_field(*args, &data_block)
    end

    def sync_has_one(name, **option, &data_block)
      _sync_define(HasOneField.new(name), option, &data_block)
    end

    def sync_has_many(name, order: :asc, propagate_when: nil, limit: nil, preload: nil, **option, &data_block)
      if data_block.nil? && preload.nil?
        preload = lambda do |records, _context, params|
          option = { order: order, limit: (params && params[:limit]) || limit }
          ArSerializer::Field.preload_association self, records, name, option
        end
        data_block = lambda do |preloaded, _context, _params|
          preloaded ? preloaded[id] || [] : send(name)
        end
      end
      field = HasManyField.new name, order: order, limit: limit, propagate_when: propagate_when
      _sync_define field, preload: preload, **option, &data_block
    end

    def _sync_define(info, **option, &data_block)
      _sync_children_info[info.name] = info
      serializer_field info.name, **option, namespace: :sync, &data_block
      serializer_field info.name, **option, &data_block
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
      collectionclass = Class.new(CollectionInfo)
      def collectionclass._sync_children_info;@foo||={};end
      collection = collectionclass.new self, name, limit: limit, order: order
      _sync_collection_info[name] = { limit: limit, order: order } # collection
      sync_parent collection, inverse_of: :records
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

    def _sync_children_info
      @_sync_children_info ||= {}
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

  def _sync_notify(action)
    if self.class._sync_self?
      ARSync.sync_send to: self, action: action, path: [], data: _sync_data
    end
    _sync_notify_parent action
  end

  def _sync_data(new_record: false)
    fallbacks = {}
    names = []
    self.class._sync_children_info.each do |name, info|
      names << name if info.type == :data
      if new_record
        fallbacks[name] = [] if info.type == :many
        fallbacks[name] = nil if info.type == :one
      end
    end
    data = ArSerializer.serialize self, names, use: :sync
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
      parent = parent_name.is_a?(Symbol) ? send(parent_name) : parent_name
      next unless parent
      association_field = parent.class._sync_children_info[inverse_name]
      next if association_field.skip_propagation? parent, self
      data2 = path ? data : association_field.data(parent, self, to_user: to_user, action: action)
      action2 = association_field.action_convert action
      path2 = [*association_field.path(self), *path]
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
    if to.is_a?(ARSync::Collection) || to.is_a?(ARSync::CollectionInfo)
      $><< (to.is_a?(ARSync::Collection) ? "\e[32m" : "\e[34m")
      p [key, action, path, data].inspect
      $><< "\e[m\n"
    end
    @sync_send_block&.call key: key, action: action, path: path, data: data
  end

  def self.sync_key(model, path, to_user = nil)
    if model.is_a? ARSync::Collection
      key = [to_user&.id, model.klass.name, model.name, path].join '/'
    elsif model.is_a? ARSync::CollectionInfo
      key = [to_user&.id, model.klass.name, path].join '/'
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
      limit: collection.info[:limit],
      order: collection.info[:order],
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
