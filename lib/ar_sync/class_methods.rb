require_relative 'field'
require_relative 'collection'

module ArSync::ClassMethodsBase
  def _sync_self?
    instance_variable_defined? '@_sync_self'
  end

  def _sync_parents_info
    @_sync_parents_info ||= []
  end

  def _sync_children_info
    @_sync_children_info ||= {}
  end

  def _sync_child_info(name)
    info = _sync_children_info[name]
    return info if info
    superclass._sync_child_info name if superclass < ActiveRecord::Base
  end

  def _each_sync_parent(&block)
    _sync_parents_info.each(&block)
    superclass._each_sync_parent(&block) if superclass < ActiveRecord::Base
  end

  def _each_sync_child(&block)
    _sync_children_info.each(&block)
    superclass._each_sync_child(&block) if superclass < ActiveRecord::Base
  end

  def sync_parent(parent, inverse_of:, only_to: nil)
    _initialize_sync_callbacks
    _sync_parents_info << [
      parent,
      { inverse_name: inverse_of, only_to: only_to }
    ]
  end
end

module ArSync::TreeSync::ClassMethods
  include ArSync::ClassMethodsBase
  def sync_collection(name)
    ArSync::Collection::Tree.find self, name
  end

  def sync_has_data(*names, **option, &original_data_block)
    @_sync_self = true
    option = option.dup
    if original_data_block
      data_block = ->(*args) { instance_exec(*args, &original_data_block).as_json }
    end
    option[:params_type] = {}
    names.each do |name|
      type_override = data_block.nil? && reflect_on_association(name.to_s.underscore) ? { type: :any } : {}
      _sync_define ArSync::DataField.new(name), option.merge(type_override), &data_block
    end
  end

  def sync_has_one(name, **option, &data_block)
    _sync_define ArSync::HasOneField.new(name), option, &data_block
  end

  def sync_has_many(name, order: :asc, propagate_when: nil, params_type: nil, limit: nil, preload: nil, association: nil, **option, &data_block)
    if data_block.nil? && preload.nil?
      underscore_name = name.to_s.underscore.to_sym
      preload = lambda do |records, _context, params|
        ArSerializer::Field.preload_association(
          self, records, association || underscore_name,
          order: (!limit && params && params[:order]) || order,
          limit: [params && params[:limit]&.to_i, limit].compact.min
        )
      end
      data_block = lambda do |preloaded, _context, _params|
        preloaded ? preloaded[id] || [] : send(name)
      end
      params_type = { limit?: :int, order?: [{ :* => %w[asc desc] }, 'asc', 'desc'] }
    else
      params_type = {}
    end
    field = ArSync::HasManyField.new name, association: association, order: order, limit: limit, propagate_when: propagate_when
    _sync_define field, preload: preload, association: association, params_type: params_type, **option, &data_block
  end

  def _sync_define(info, **option, &data_block)
    _initialize_sync_callbacks
    _sync_children_info[info.name] = info
    serializer_field info.name, **option, &data_block unless _serializer_field_info info.name
    serializer_field info.name, **option, namespace: :sync, &data_block
  end

  def sync_define_collection(name, limit: nil, order: :asc)
    _initialize_sync_callbacks
    collection = ArSync::Collection::Tree.new self, name, limit: limit, order: order
    sync_parent collection, inverse_of: [self, name]
  end

  def _initialize_sync_callbacks
    return if instance_variable_defined? '@_sync_callbacks_initialized'
    @_sync_callbacks_initialized = true
    _sync_define ArSync::DataField.new(:id)
    %i[create update destroy].each do |action|
      after_commit on: action do
        next if ArSync.skip_notification?
        self.class.default_scoped.scoping { _sync_notify action }
      end
    end
  end
end

module ArSync::GraphSync::ClassMethods
  include ArSync::ClassMethodsBase
  def sync_collection(name)
    ArSync::Collection::Graph.find self, name
  end

  def sync_has_data(*names, **option, &data_block)
    @_sync_self = true
    names.each do |name|
      _sync_children_info[name] = nil
      _sync_define name, option, &data_block
    end
  end

  def sync_has_many(name, **option, &data_block)
    _sync_children_info[name] = [:many, option, data_block]
    _sync_has_many name, option, &data_block
  end

  def sync_has_one(name, **option, &data_block)
    _sync_children_info[name] = [:one, option, data_block]
    _sync_define name, option, &data_block
  end

  def _sync_has_many(name, order: :asc, limit: nil, preload: nil, association: nil, **option, &data_block)
    raise "order not in [:asc, :desc] : #{order}" unless %i[asc desc].include? order
    if data_block.nil? && preload.nil?
      underscore_name = name.to_s.underscore.to_sym
      preload = lambda do |records, _context, params|
        ArSerializer::Field.preload_association(
          self, records, association || underscore_name,
          order: (!limit && params && params[:order]) || order,
          limit: [params && params[:limit]&.to_i, limit].compact.min
        )
      end
      data_block = lambda do |preloaded, _context, params|
        records = preloaded ? preloaded[id] || [] : send(name)
        next records unless limit || order == :asc
        ArSync::CollectionWithOrder.new(
          records,
          order: (!limit && params && params[:order]) || order,
          limit: [params && params[:limit]&.to_i, limit].compact.min
        )
      end
      params_type = { limit?: :int, order?: [{ :* => %w[asc desc] }, 'asc', 'desc'] }
    else
      params_type = {}
    end
    _sync_define name, preload: preload, association: association, **option.merge(params_type: params_type), &data_block
  end

  def _sync_define(name, **option, &data_block)
    _initialize_sync_callbacks
    serializer_field name, **option, &data_block unless _serializer_field_info name
    serializer_field name, **option, namespace: :sync, &data_block
  end

  def sync_define_collection(name, limit: nil, order: :asc)
    _initialize_sync_callbacks
    collection = ArSync::Collection::Graph.new self, name, limit: limit, order: order
    sync_parent collection, inverse_of: [self, name]
  end

  def _initialize_sync_callbacks
    return if instance_variable_defined? '@_sync_callbacks_initialized'
    @_sync_callbacks_initialized = true
    mod = Module.new do
      def write_attribute(attr_name, value)
        self.class.default_scoped.scoping do
          @_sync_parents_info_before_mutation ||= _sync_current_parents_info
          @_sync_belongs_to_info_before_mutation ||= _sync_current_belongs_to_info
        end
        super attr_name, value
      end
    end
    prepend mod
    attr_reader :_sync_parents_info_before_mutation, :_sync_belongs_to_info_before_mutation

    _sync_define :id

    _sync_define :sync_keys, type: [:string] do |current_user|
      ArSync.sync_graph_keys self, current_user
    end

    _sync_define :defaults, namespace: :sync do |current_user|
      { sync_keys: ArSync.sync_graph_keys(self, current_user) }
    end

    before_destroy do
      @_sync_parents_info_before_mutation ||= _sync_current_parents_info
      @_sync_belongs_to_info_before_mutation ||= _sync_current_belongs_to_info
    end

    before_save on: :create do
      @_sync_parents_info_before_mutation ||= _sync_current_parents_info
      @_sync_belongs_to_info_before_mutation ||= _sync_current_belongs_to_info
    end

    %i[create update destroy].each do |action|
      after_commit on: action do
        next if ArSync.skip_notification?
        self.class.default_scoped.scoping { _sync_notify action }
        @_sync_parents_info_before_mutation = nil
        @_sync_belongs_to_info_before_mutation = nil
      end
    end
  end
end
