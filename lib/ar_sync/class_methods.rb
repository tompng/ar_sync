require_relative 'field'
require_relative 'collection'

module ArSync::ClassMethods
  def sync_has_data(*names, user_specific: nil, **option, &original_data_block)
    @_sync_self = true
    option = option.dup
    if original_data_block
      data_block = ->(*args) { instance_exec(*args, &original_data_block).as_json }
    end
    option[:params_type] = {}
    names.each do |name|
      type_override = reflect_on_association(name.to_s.underscore) ? { type: :any } : {}
      _sync_define ArSync::DataField.new(name, user_specific: user_specific), option.merge(type_override), &data_block
    end
  end

  def api_has_field(*args, &data_block)
    serializer_field(*args, &data_block)
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
      params_type = { limit: :int, order: :any }
    else
      params_type = {}
    end
    field = ArSync::HasManyField.new name, association: association, order: order, limit: limit, propagate_when: propagate_when
    _sync_define field, preload: preload, association: association, params_type: params_type, **option, &data_block
  end

  def _sync_define(info, **option, &data_block)
    _initialize_sync_callbacks
    _sync_children_info[info.name] = info
    serializer_field info.name, **option, namespace: :sync, &data_block
    serializer_field info.name, **option, &data_block
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
    collection = ArSync::Collection.new self, name, limit: limit, order: order
    sync_parent collection, inverse_of: [self, name]
  end

  def sync_collection(name)
    ArSync::Collection.find self, name
  end

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
