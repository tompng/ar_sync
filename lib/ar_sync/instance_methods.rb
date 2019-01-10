module ArSync::InstanceMethods
  def _sync_notify(action)
    if self.class._sync_self?
      data = action == :destroy ? nil : _sync_data
      ArSync.sync_send to: self, action: action, path: [], data: data
    end
    _sync_notify_parent action
  end

  def _sync_data(new_record: false)
    fallbacks = {}
    names = []
    self.class._each_sync_child do |name, info|
      names << name if info.type == :data && !info.user_specific?
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
      ArSync.sync_send to: self, action: :event, path: path, data: event_data, to_user: to_user
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
      ArSync.sync_send(
        to: parent, action: action2, path: path2, data: data2,
        to_user: only_to_user2,
        ordering: order_param2
      )
      parent._sync_notify_parent action2, path: path2, data: data2, order_param: order_param2, only_to_user: to_user || only_to_user
    end
  end
end
