class ArSync::Collection
  attr_reader :klass, :name, :limit, :order
  def initialize(klass, name, limit: nil, order: nil)
    @klass = klass
    @name = name
    @limit = limit
    @order = order
    self.class.defined_collections[[klass, name]] = self
    define_singleton_method name do
      to_a
    end
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

  def _sync_notify_child_changed(_child, _name, _to_user, _owned); end

  def _sync_notify_child_added(child, _name, to_user, _owned)
    ArSync.sync_send to: self, action: :add, model: child, path: :collection, to_user: to_user
  end

  def _sync_notify_child_removed(child, _name, to_user, _owned)
    ArSync.sync_send to: self, action: :remove, model: child, path: :collection, to_user: to_user
  end

  def self.find(klass, name)
    defined_collections[[klass, name]]
  end
end
