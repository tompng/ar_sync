require_relative 'field'

class ArSync::Collection
  attr_reader :klass, :name, :limit, :order
  def initialize(klass, name, limit: nil, order: nil)
    @klass = klass
    @name = name
    @limit = limit
    @order = order
    @field = ArSync::CollectionField.new name, limit: limit, order: order
    self.class._sync_children_info[[klass, name]] = @field
    self.class.defined_collections[[klass, name]] = self
    define_singleton_method name do
      to_a
    end
  end

  def _sync_notify_parent(*); end

  def sync_send_event(type:, to_user: nil, data:)
    event_data = { type: type, data: data }
    ArSync.sync_send to: self, action: :event, path: [], data: event_data, to_user: to_user
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

  def self._sync_children_info
    @sync_children_info ||= {}
  end

  def self._sync_child_info(key)
    _sync_children_info[key]
  end

  def self.find(klass, name)
    defined_collections[[klass, name]]
  end
end
