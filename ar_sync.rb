module ARSync
  extend ActiveSupport::Concern
  def self.sync_has_one(name, records: nil, &block)
    sync_children name, inverse_of: inverse_of, records: records, multiple: false, &block
  end

  def self.sync_has_many(name, records: nil, &block)
    sync_children name, inverse_of: inverse_of, records: records, multiple: true, &block
  end

  def self.sync_children(name, multiple:, records:, &data_block)
    records ||= name.to_sym.to_proc
    records = records.to_proc if records.is_a?(Symbol)
    data_block ||= name.to_sym.to_proc
    @sync_children ||= {}
    @sync_children[name] = [records, data_block, multiple]
  end

  def self.sync_self(&block)
    @sync_self_block = block || :sync_data.to_proc
  end

  def self.sync_belongs_to(parent, as:, &data_block)
    data_block ||= :sync_data.to_proc
    @sync_parents ||= {}
    @sync_parents[parent] = [as, data_block]
  end

  def self._sync_self_block
    @sync_self_block
  end

  def self._sync_children_info
    @sync_children
  end

  included do
    %i[create update destroy].each do |action|
      after_commit on: action { _sync_notify action }
    end
  end

  def sync_data
    as_json
  end

  def _sync_notify(action)
    sync_self_block = self.class._sync_self_block
    _sync_send action, [], instance_exec(&sync_self_block) if sync_self_block
    _sync_notify_parent action
  end

  def _sync_notify_parent(action, path: nil, data: nil)
    @sync_parents.each do |parent_name, (name, data_block)|
      parent = send parent_name
      _records_block, child_data_block, multiple = parent.class._sync_children_info[name]
      raise "Duplicate data_block `#{name}` in `#{parent.class}` and `#{self.class.name}`" if data_block && child_data_block
      data_block ||= child_data_block
      action2 = action
      if multiple
        data = instance_exec(&data_block) if path.nil?
        path2 = [[name, id], *path]
      else
        path2 = [[name], *path]
        if path
          data2 = data
        else
          data2 = instance_exec(&data_block)
          action2 = :update
        end
      end
      parent._sync_send action2, path2, data2
      parent._sync_notify_parent action2, path2, data2
    end
  end

  def _sync_send(action, path, data)
    [self.class.name.underscore, id, action, path, data]
  end
end
