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
    self.class._sync_children_info.each do |name, info|
      names << name if info.type == :data
      if new_record
        fallbacks[name] = [] if info.type == :many
        fallbacks[name] = nil if info.type == :one
      end
    end
    data = ArSerializer.serialize self, names, use: :sync
    fallbacks.update data
  end

  def _sync_notify_parent(action, path: nil, data: nil, only_to_user: nil)
    self.class._sync_parents_info.each do |parent_name, inverse_name:, only_to:|
      if only_to
        to_user = instance_exec(&only_to)
        next unless to_user
        next if only_to_user && only_to_user != to_user
      end
      parent = parent_name.is_a?(Symbol) ? send(parent_name) : parent_name
      next unless parent
      association_field = parent.class._sync_children_info[inverse_name]
      next if association_field.skip_propagation? parent, self, path
      data2 = path ? data : association_field.data(parent, self, to_user: to_user, action: action)
      action2 = association_field.action_convert action
      path2 = [*association_field.path(self), *path]
      ArSync.sync_send(
        to: parent, action: action2, path: path2, data: data2,
        to_user: to_user || only_to_user,
        ordering: association_field.order_param
      )
      parent._sync_notify_parent action2, path: path2, data: data2, only_to_user: to_user || only_to_user
    end
  end
end
