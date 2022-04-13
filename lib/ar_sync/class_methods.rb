require_relative 'collection'

module ArSync::ModelBase::ClassMethods
  def _sync_self?
    return true if defined?(@_sync_self)

    superclass._sync_self? if superclass < ActiveRecord::Base
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
    _sync_parents_info.each { |parent, options| block.call(parent, **options) }
    superclass._each_sync_parent(&block) if superclass < ActiveRecord::Base
  end

  def _each_sync_child(&block)
    _sync_children_info.each(&block)
    superclass._each_sync_child(&block) if superclass < ActiveRecord::Base
  end

  def sync_parent(parent, inverse_of:, only_to: nil, watch: nil)
    _initialize_sync_callbacks
    _sync_parents_info << [
      parent,
      { inverse_name: inverse_of, only_to: only_to, watch: watch }
    ]
  end

  def sync_collection(name)
    ArSync::Collection.find self, name
  end

  def sync_has_data(*names, **option, &data_block)
    @_sync_self = true
    names.each do |name|
      _sync_children_info[name] = nil
      _sync_define name, **option, &data_block
    end
  end

  def sync_has_many(name, **option, &data_block)
    _sync_children_info[name] = [:many, option, data_block]
    _sync_has_many name, **option, &data_block
  end

  def sync_has_one(name, **option, &data_block)
    _sync_children_info[name] = [:one, option, data_block]
    _sync_define name, **option, &data_block
  end

  def _sync_has_many(name, direction: :asc, first: nil, last: nil, preload: nil, association: nil, **option, &data_block)
    raise ArgumentError, 'direction not in [:asc, :desc]' unless %i[asc desc].include? direction
    raise ArgumentError, 'first and last cannot be both specified' if first && last
    raise ArgumentError, 'cannot use first or last with direction: :desc' if direction != :asc && !first && !last
    if data_block.nil? && preload.nil?
      underscore_name = name.to_s.underscore.to_sym
      order_option_from_params = lambda do |params|
        if first || last
          params_first = first && [first, params[:first]&.to_i].compact.min
          params_last = last && [last, params[:last]&.to_i].compact.min
          { direction: direction, first: params_first, last: params_last }
        else
          {
            first: params[:first]&.to_i,
            last: params[:last]&.to_i,
            order_by: params[:order_by],
            direction: params[:direction] || :asc
          }
        end
      end
      preload = lambda do |records, _context, **params|
        ArSerializer::Field.preload_association(
          self,
          records,
          association || underscore_name,
          **order_option_from_params.call(params)
        )
      end
      data_block = lambda do |preloaded, _context, **params|
        records = preloaded ? preloaded[id] || [] : __send__(name)
        next records unless first || last
        ArSync::CollectionWithOrder.new(
          records,
          **order_option_from_params.call(params)
        )
      end
      serializer_data_block = lambda do |preloaded, _context, **_params|
        preloaded ? preloaded[id] || [] : __send__(name)
      end
      if first
        params_type = { first?: :int }
      elsif last
        params_type = { last?: :int }
      else
        params_type = lambda do
          orderable_keys = reflect_on_association(underscore_name).klass._serializer_orderable_field_keys
          orderable_keys &= [*option[:only]].map(&:to_s) if option[:only]
          orderable_keys -= [*option[:except]].map(&:to_s) if option[:except]
          orderable_keys |= ['id']
          order_by = orderable_keys.size == 1 ? orderable_keys.first : orderable_keys.sort
          { first?: :int, last?: :int, direction?: %w[asc desc], orderBy?: order_by }
        end
      end
    else
      params_type = {}
    end
    _sync_define(
      name,
      serializer_data_block: serializer_data_block,
      preload: preload,
      association: association,
      params_type: params_type,
      **option,
      &data_block
    )
  end

  def _sync_define(name, serializer_data_block: nil, **option, &data_block)
    _initialize_sync_callbacks
    serializer_field name, **option, &(serializer_data_block || data_block) unless _serializer_field_info name
    serializer_field name, **option, namespace: :sync, &data_block
  end

  def sync_define_collection(name, first: nil, last: nil, direction: :asc)
    _initialize_sync_callbacks
    collection = ArSync::Collection.new self, name, first: first, last: last, direction: direction
    sync_parent collection, inverse_of: [self, name]
  end

  module WriteHook
    def _initialize_sync_info_before_mutation
      return unless defined? @_initialized
      if new_record?
        @_sync_watch_values_before_mutation ||= {}
        @_sync_parents_info_before_mutation ||= {}
        @_sync_belongs_to_info_before_mutation ||= {}
      else
        self.class.default_scoped.scoping do
          @_sync_watch_values_before_mutation ||= _sync_current_watch_values
          @_sync_parents_info_before_mutation ||= _sync_current_parents_info
          @_sync_belongs_to_info_before_mutation ||= _sync_current_belongs_to_info
        end
      end
    end
    def _write_attribute(attr_name, value)
      _initialize_sync_info_before_mutation
      super attr_name, value
    end
    def write_attribute(attr_name, value)
      _initialize_sync_info_before_mutation
      super attr_name, value
    end
  end

  def _initialize_sync_callbacks
    return if defined? @_sync_callbacks_initialized
    @_sync_callbacks_initialized = true
    prepend WriteHook
    attr_reader :_sync_parents_info_before_mutation, :_sync_belongs_to_info_before_mutation, :_sync_watch_values_before_mutation

    _sync_define :id

    _sync_define :sync_keys, type: [:string] do |current_user|
      ArSync.sync_keys self, current_user
    end

    serializer_defaults namespace: :sync do |current_user|
      { id: id, sync_keys: ArSync.sync_keys(self, current_user) }
    end

    after_initialize do
      @_initialized = true
    end

    before_destroy do
      @_sync_parents_info_before_mutation ||= _sync_current_parents_info
      @_sync_watch_values_before_mutation ||= _sync_current_watch_values
      @_sync_belongs_to_info_before_mutation ||= _sync_current_belongs_to_info
    end

    %i[create update destroy].each do |action|
      after_commit on: action do
        next if ArSync.skip_notification?
        self.class.default_scoped.scoping { _sync_notify action }
        @_sync_watch_values_before_mutation = nil
        @_sync_parents_info_before_mutation = nil
        @_sync_belongs_to_info_before_mutation = nil
      end
    end
  end
end
