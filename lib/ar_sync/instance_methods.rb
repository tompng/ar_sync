module ArSync::ModelBase::InstanceMethods
  def _sync_notify(action)
    _sync_notify_parent action
    _sync_notify_self if self.class._sync_self? && action == :update
  end

  def _sync_current_watch_values
    values = {}
    self.class._each_sync_parent do |_, info|
      [*info[:watch]].each do |watch|
        values[watch] = watch.is_a?(Proc) ? instance_exec(&watch) : send(watch)
      end
    end
    values
  end

  def _sync_current_parents_info
    parents = []
    self.class._each_sync_parent do |parent, inverse_name:, only_to:, watch:|
      parent = send parent if parent.is_a? Symbol
      parent = instance_exec(&parent) if parent.is_a? Proc
      if only_to
        to_user = only_to.is_a?(Symbol) ? instance_eval(&only_to) : instance_exec(&only_to)
        parent = nil unless to_user
      end
      inverse_name = instance_exec(&inverse_name) if inverse_name.is_a? Proc
      owned = parent.class._sync_child_info(inverse_name).present? if parent
      parents << [parent, [inverse_name, to_user, owned, watch]]
    end
    parents
  end

  def _serializer_field_value(name)
    field = self.class._serializer_field_info name
    preloadeds = field.preloaders.map do |preloader|
      args = [[self], nil]
      preloader.call(*(preloader.arity < 0 ? args : args.take(preloader.arity)))
    end
    instance_exec(*preloadeds, nil, &field.data_block)
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
      return unless parents_was
      parents = parents_was.map { nil }
    else
      parents_was = _sync_parents_info_before_mutation
      return unless parents_was
      parents = _sync_current_parents_info
      column_values_was = _sync_watch_values_before_mutation || {}
      column_values = _sync_current_watch_values
    end
    parents_was.zip(parents).each do |(parent_was, info_was), (parent, info)|
      name, to_user, owned, watch = info
      name_was, to_user_was, owned_was = info_was
      if parent_was != parent || info_was != info
        if owned_was
          parent_was&._sync_notify_child_removed self, name_was, to_user_was
        else
          parent_was&._sync_notify_child_changed name_was, to_user_was
        end
        if owned
          parent&._sync_notify_child_added self, name, to_user
        else
          parent&._sync_notify_child_changed name, to_user
        end
      elsif parent
        changed = [*watch].any? do |w|
          column_values_was[w] != column_values[w]
        end
        parent._sync_notify_child_changed name, to_user if changed
      end
    end
  end

  def _sync_notify_child_removed(child, name, to_user)
    ArSync.sync_send to: self, action: :remove, model: child, path: name, to_user: to_user
  end

  def _sync_notify_child_added(child, name, to_user)
    ArSync.sync_send to: self, action: :add, model: child, path: name, to_user: to_user
  end

  def _sync_notify_child_changed(name, to_user)
    ArSync.sync_send to: self, action: :update, model: self, field: name, to_user: to_user
  end

  def _sync_notify_self
    belongs_was = _sync_belongs_to_info_before_mutation
    return unless belongs_was
    belongs = _sync_current_belongs_to_info
    belongs.each do |name, info|
      next if belongs_was[name] == info
      value = info.key?(:value) ? info[:value] : _serializer_field_value(name)
      _sync_notify_child_added value, name, nil if value.is_a? ArSerializer::Serializable
      _sync_notify_child_removed value, name, nil if value.nil?
    end
    ArSync.sync_send to: self, action: :update, model: self
  end
end
