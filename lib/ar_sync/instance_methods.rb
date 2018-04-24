module ArSync::InstanceMethods
  def _sync_notify(action)
    _sync_notify_parent action
    _sync_notify_self if self.class._sync_self? && action == :update
  end

  def _sync_current_parents_info
    [].tap do |parents|
      self.class._each_sync_parent do |parent, inverse_name:, only_to:, owned:|
        parent = send parent if parent.is_a? Symbol
        parent = instance_exec(&parent) if parent.is_a? Proc
        if only_to
          to_user = instance_exec(&only_to)
          parent = nil unless to_user
        end
        parents << [parent, [inverse_name, to_user, owned]]
      end
    end
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
      ArSync.sync_send to: self, action: :remove, model: child, path: name, to_user: to_user
    else
      ArSync.sync_send to: self, action: :update, model: self, to_user: to_user
    end
  end

  def _sync_notify_child_added(child, name, to_user, owned)
    if owned
      ArSync.sync_send to: self, action: :add, model: child, path: name, to_user: to_user
    else
      ArSync.sync_send to: self, action: :update, model: self, to_user: to_user
    end
  end

  def _sync_notify_child_changed(_child, _name, to_user, owned)
    return if owned
    ArSync.sync_send(to: self, action: :update, model: self, to_user: to_user)
  end

  def _sync_notify_self
    ArSync.sync_send(to: self, action: :update, model: self)
  end
end
