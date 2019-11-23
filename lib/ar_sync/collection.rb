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

  def sync_send_event(type:, to_user: nil, data:)
    event_data = { type: type, data: data }
    ArSync.sync_tree_send to: self, action: :event, path: [], data: event_data, to_user: to_user
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
end

class ArSync::Collection::Tree < ArSync::Collection
  def initialize(*)
    super
    @field = ArSync::CollectionField.new @name, limit: @limit, order: @order
    self.class._sync_children_info[[@klass, @name]] = @field
  end

  def _sync_notify_parent(*); end

  def self._sync_children_info
    @sync_children_info ||= {}
  end

  def self._sync_child_info(key)
    _sync_children_info[key]
  end
end

class ArSync::Collection::Graph < ArSync::Collection
  def _sync_notify_child_changed(_name, _to_user); end

  def _sync_notify_child_added(child, _name, to_user)
    ArSync.sync_graph_send to: self, action: :add, model: child, path: :collection, to_user: to_user
  end

  def _sync_notify_child_removed(child, _name, to_user, _owned)
    ArSync.sync_graph_send to: self, action: :remove, model: child, path: :collection, to_user: to_user
  end

  def self._sync_children_info
    @sync_children_info ||= {}
  end

  def self._sync_child_info(key)
    _sync_children_info[key]
  end
end

class ArSync::CollectionWithOrder < ArSerializer::CompositeValue
  def initialize(records, order:, limit:)
    @records = records
    @order = { mode: order, limit: limit }
  end

  def ar_serializer_build_sub_calls
    values = @records.map { {} }
    [{ order: @order, collection: values }, @records.zip(values)]
  end
end
