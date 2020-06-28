require_relative 'field'

class ArSync::Collection
  attr_reader :klass, :name, :limit, :order
  def initialize(klass, name, limit: nil, order: nil)
    @klass = klass
    @name = name
    @limit = limit
    @order = order
    self.class.defined_collections[[klass, name]] = self
    define_singleton_method(name) { to_a }
  end

  def to_a
    all = klass.all
    all = all.order id: order if order
    all = all.limit limit if limit
    all
  end

  def self.defined_collections
    @defined_collections ||= {}
  end

  def self.find(klass, name)
    defined_collections[[klass, name]]
  end

  def _sync_notify_child_changed(_name, _to_user); end

  def _sync_notify_child_added(child, _name, to_user)
    ArSync.sync_send to: self, action: :add, model: child, path: :collection, to_user: to_user
  end

  def _sync_notify_child_removed(child, _name, to_user, _owned)
    ArSync.sync_send to: self, action: :remove, model: child, path: :collection, to_user: to_user
  end

  def self._sync_children_info
    @sync_children_info ||= {}
  end

  def self._sync_child_info(key)
    _sync_children_info[key]
  end
end

class ArSync::CollectionWithOrder # TODO: extends ArSerializer::CustomSerializable
  def initialize(records, order:, limit:)
    @ar_custom_serializable_models = records
    @order = { mode: order, limit: limit }
  end

  def ar_custom_serializable_data(results)
    { order: @order, collection: @ar_custom_serializable_models.map(&results).compact }
  end

  # TODO: delete
  attr_reader :ar_custom_serializable_models
  def ar_serializer_build_sub_calls
    values = @ar_custom_serializable_models.map { {} }
    [{ order: @order, collection: values }, @ar_custom_serializable_models.zip(values)]
  end
end
