module ArSync::InstanceMethods
  def _sync_notify(action)
    if self.class._sync_self?
      ArSync.sync_send to: self, action: action, path: [], data: _sync_data
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
    data = ArSerializer.serialize self, names, use: :sync
    fallbacks.update data
  end

  def _sync_notify_parent(action, path: nil, data: nil, order_param: nil, only_to_user: nil)
    self.class._each_sync_parent do |parent, inverse_name:, only_to:|
      if only_to
        to_user = only_to.is_a?(Symbol) ? instance_eval(&only_to) : instance_exec(&only_to)
        next unless to_user
        next if only_to_user && only_to_user != to_user
        only_to_user = to_user
      end
      parent = send(parent) if parent.is_a? Symbol
      parent = instance_exec(&parent) if parent.is_a? Proc
      next unless parent
      inverse_name = instance_exec(&inverse_name) if inverse_name.is_a? Proc
      next unless inverse_name
      association_field = parent.class._sync_child_info inverse_name
      next if association_field.skip_propagation? parent, self, path
      data2 = path ? data : association_field.data(parent, self, to_user: to_user, action: action)
      order_param2 = path ? order_param : association_field.order_param
      action2 = association_field.action_convert action
      path2 = [*association_field.path(self), *path]
      ArSync.sync_send(
        to: parent, action: action2, path: path2, data: data2,
        to_user: only_to_user,
        ordering: order_param2
      )
      parent._sync_notify_parent action2, path: path2, data: data2, order_param: order_param2, only_to_user: to_user || only_to_user
    end
  end
end
