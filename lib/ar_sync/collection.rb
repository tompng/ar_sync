class ArSync::Collection
  attr_reader :klass, :name, :first, :last, :direction, :ordering
  def initialize(klass, name, first: nil, last: nil, direction: nil)
    direction ||= :asc
    @klass = klass
    @name = name
    @first = first
    @last = last
    @direction = direction
    @ordering = { first: first, last: last, direction: direction }.compact
    self.class.defined_collections[[klass, name]] = self
    define_singleton_method(name) { to_a }
  end

  def to_a
    if first
      klass.order(id: direction).limit(first).to_a
    elsif last
      rev = direction == :asc ? :desc : :asc
      klass.order(id: rev).limit(last).reverse
    else
      klass.all.to_a
    end
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

class ArSync::CollectionWithOrder < ArSerializer::CustomSerializable
  def initialize(records, direction:, first: nil, last: nil)
    super records do |results|
      {
        ordering: { direction: direction || :asc, first: first, last: last }.compact,
        collection: records.map(&results).compact
      }
    end
  end
end
