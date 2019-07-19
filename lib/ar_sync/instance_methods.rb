module ArSync::TreeSync::InstanceMethods
  def _sync_notify(action)
    if self.class._sync_self?
      data = action == :destroy ? nil : _sync_data
      ArSync.sync_tree_send to: self, action: action, path: [], data: data
    end
    _sync_notify_parent action
  end

  def _sync_data(new_record: false)
    fallbacks = {}
    names = []
    self.class._each_sync_child do |name, info|
      names << name if info.type == :data
      if new_record
        fallbacks[name] = [] if info.type == :many
        fallbacks[name] = nil if info.type == :one
      end
    end
    data = ArSync.serialize self, names
    fallbacks.update data
  end

  def sync_send_event(type:, relation: nil, to_user: nil, data:)
    path = [*relation]
    event_data = { type: type, data: data }
    if self.class._sync_self?
      ArSync.sync_tree_send to: self, action: :event, path: path, data: event_data, to_user: to_user
    end
    _sync_notify_parent(:event, path: path, data: event_data, only_to_user: to_user)
  end

  def _sync_notify_parent(action, path: nil, data: nil, order_param: nil, only_to_user: nil)
    self.class._each_sync_parent do |parent, inverse_name:, only_to:|
      parent = send(parent) if parent.is_a? Symbol
      parent = instance_exec(&parent) if parent.is_a? Proc
      next unless parent
      next if parent.respond_to?(:destroyed?) && parent.destroyed?
      inverse_name = instance_exec(&inverse_name) if inverse_name.is_a? Proc
      next unless inverse_name
      association_field = parent.class._sync_child_info inverse_name
      next if association_field.skip_propagation? parent, self, path
      action2 = association_field.action_convert action
      only_to_user2 = only_to_user
      if only_to
        to_user = only_to.is_a?(Symbol) ? instance_eval(&only_to) : instance_exec(&only_to)
        next unless to_user
        next if only_to_user && only_to_user != to_user
        only_to_user2 = to_user
      end
      data2 = path || action2 == :destroy ? data : association_field.data(parent, self, to_user: to_user, action: action)
      order_param2 = path ? order_param : association_field.order_param
      path2 = [*association_field.path(self), *path]
      ArSync.sync_tree_send(
        to: parent, action: action2, path: path2, data: data2,
        to_user: only_to_user2,
        ordering: order_param2
      )
      parent._sync_notify_parent action2, path: path2, data: data2, order_param: order_param2, only_to_user: to_user || only_to_user
    end
  end
end

module ArSync::GraphSync::InstanceMethods
  def _sync_notify(action)
    _sync_notify_parent action
    _sync_notify_self if self.class._sync_self? && action == :update
  end

  def _sync_current_parents_info
    parents = []
    self.class._each_sync_parent do |parent, inverse_name:, only_to:|
      parent = send parent if parent.is_a? Symbol
      parent = instance_exec(&parent) if parent.is_a? Proc
      if only_to
        to_user = only_to.is_a?(Symbol) ? instance_eval(&only_to) : instance_exec(&only_to)
        parent = nil unless to_user
      end
      inverse_name = instance_exec(&inverse_name) if inverse_name.is_a? Proc
      owned = parent.class._sync_child_info(inverse_name).present? if parent
      parents << [parent, [inverse_name, to_user, owned]]
    end
    parents
  end

  def _serializer_field_value(name)
    field = self.class._serializer_field_info name
    preloadeds = field.preloaders.map do |preloader|
      args = [[self], nil, {}]
      preloader.call(*(preloader.arity < 0 ? args : args.take(preloader.arity)))
    end
    instance_exec(*preloadeds, nil, {}, &field.data_block)
  end

  def _sync_current_belongs_to_info
    belongs = {}
    self.class._each_sync_child do |name, (type, option, data_block)|
      next unless type == :one
      option ||= {}
      association_name = (option[:association] || name).to_s.underscore
      association = self.class.reflect_on_association association_name
      next if association && !association.belongs_to?
      if association && !option[:preload] && !data_block
        belongs[name] = {
          type: association.foreign_type && self[association.foreign_type],
          id: self[association.foreign_key]
        }
      else
        belongs[name] = { value: _serializer_field_value(name) }
      end
    end
    belongs
  end

  def _sync_notify_parent(action)
    if action == :create
      parents = _sync_current_parents_info
      parents_was = parents.map { nil }
    elsif action == :destroy
      parents_was = _sync_parents_info_before_mutation
      parents = parents_was.map { nil }
    else
      parents_was = _sync_parents_info_before_mutation
      parents = _sync_current_parents_info
    end
    parents_was.zip(parents).each do |(parent_was, info_was), (parent, info)|
      if parent_was == parent && info_was == info
        parent&._sync_notify_child_changed self, *info
      else
        parent_was&._sync_notify_child_removed self, *info_was
        parent&._sync_notify_child_added self, *info
      end
    end
  end

  def _sync_notify_child_removed(child, name, to_user, owned)
    if owned
      ArSync.sync_graph_send to: self, action: :remove, model: child, path: name, to_user: to_user
    else
      ArSync.sync_graph_send to: self, action: :update, model: self, to_user: to_user
    end
  end

  def _sync_notify_child_added(child, name, to_user, owned)
    if owned
      ArSync.sync_graph_send to: self, action: :add, model: child, path: name, to_user: to_user
    else
      ArSync.sync_graph_send to: self, action: :update, model: self, to_user: to_user
    end
  end

  def _sync_notify_child_changed(_child, _name, to_user, owned)
    return if owned
    ArSync.sync_graph_send(to: self, action: :update, model: self, to_user: to_user)
  end

  def _sync_notify_self
    belongs_was = _sync_belongs_to_info_before_mutation
    belongs = _sync_current_belongs_to_info
    belongs.each do |name, info|
      next if belongs_was[name] == info
      value = info.key?(:value) ? info[:value] : _serializer_field_value(name)
      _sync_notify_child_added value, name, nil, true if value.is_a? ArSerializer::Serializable
      _sync_notify_child_removed value, name, nil, true if value.nil?
    end
    ArSync.sync_graph_send(to: self, action: :update, model: self)
  end
end
