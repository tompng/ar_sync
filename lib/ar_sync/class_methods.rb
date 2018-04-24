require_relative 'collection'

class ArSync::CollectionWithOrder < ArSerializer::CompositeValue
  def initialize(records, order:, limit:)
    @records = records
    @order = { mode: order, limit: limit }
  end

  def build
    values = @records.map { {} }
    [{ order: @order, collection: values }, @records.zip(values)]
  end

end
module ArSync::ClassMethods
  def sync_field(*names, **option, &data_block)
    @_sync_self = true
    names.each do |name|
      reflection = reflect_on_association option[:association] || name
      if reflection&.is_a? ActiveRecord::Reflection::HasManyReflection
        _sync_has_many name, option, &data_block
      elsif reflection
        _sync_has_one name, option, &data_block
      else
        _sync_define name, option, &data_block
      end
    end
  end

  def _sync_has_one(name, **option, &data_block)
    _sync_define name, option, &data_block
  end

  def _sync_has_many(name, order: :asc, limit: nil, preload: nil, association: nil, **option, &data_block)
    raise "order not in [:asc, :desc] : #{order}" unless order.in? %i[asc desc]
    if data_block.nil? && preload.nil?
      preload = lambda do |records, _context, params|
        ArSerializer::Field.preload_association(
          self, records, association || name,
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
    end
    _sync_define name, preload: preload, association: association, **option, &data_block
  end

  def _sync_define(name, **option, &data_block)
    _initialize_sync_callbacks
    serializer_field name, **option, namespace: :sync, &data_block
    serializer_field name, **option, &data_block
  end

  def sync_parent(parent, inverse_of: nil, affects: nil, only_to: nil)
    raise ArgumentError unless [inverse_of, affects].compact.size == 1
    _initialize_sync_callbacks
    _sync_parents_info << [
      parent,
      { inverse_name: inverse_of || affects, only_to: only_to, owned: inverse_of.present? }
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

  def _each_sync_parent(&block)
    _sync_parents_info.each(&block)
    superclass._each_sync_parent(&block) if superclass < ActiveRecord::Base
  end

  def _initialize_sync_callbacks
    return if instance_variable_defined? '@_sync_callbacks_initialized'
    mod = Module.new do
      def write_attribute(attr_name, value)
        self.class.default_scoped.scoping do
          @_sync_parents_info_before_mutation ||= _sync_current_parents_info
        end
        super attr_name, value
      end
    end
    prepend mod
    attr_reader :_sync_parents_info_before_mutation
    @_sync_callbacks_initialized = true
    _sync_define :id

    sync_field :sync_keys do |current_user|
      ArSync.sync_keys(self, current_user)
    end

    before_destroy do
      @_sync_parents_info_before_mutation ||= _sync_current_parents_info
    end

    before_save on: :create do
      @_sync_parents_info_before_mutation ||= _sync_current_parents_info
    end

    %i[create update destroy].each do |action|
      after_commit on: action do
        self.class.default_scoped.scoping { _sync_notify action }
        @_sync_parents_info_before_mutation = nil
      end
    end
  end
end
