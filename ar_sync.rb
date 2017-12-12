require_relative 'ar_preload'
module ARSync
  extend ActiveSupport::Concern
  module ClassMethods
    def sync_has_data(name, **option, &data_block)
      _sync_define(:data, name, option, &data_block)
    end

    def sync_has_one(name, **option, &data_block)
      _sync_define(:one, name, option, &data_block)
    end

    def sync_has_many(name, **option, &data_block)
      _sync_define(:many, name, option, &data_block)
    end

    def _sync_define(type, name, option, &data_block)
      _sync_children_type[name] = type
      data_block ||= ->(*_preloads) { send name }
      preloadable name, option, &data_block
    end

    def sync_self
      @_sync_self = true
    end

    def sync_belongs_to(parent, as:)
      _sync_parents_inverse_of[parent] = as
    end

    def _sync_self?
      @_sync_self
    end

    def _sync_parents_inverse_of
      @_sync_parents_inverse_of ||= {}
    end

    def _sync_children_type
      @_sync_children_type ||= {}
    end
  end

  included do
    include ARPreload
    %i[create update destroy].each do |action|
      after_commit(on: action) { _sync_notify action }
    end
  end

  def _sync_notify(action)
    if self.class._sync_self?
      ARSync.sync_send to: self, action: action, path: [], data: _sync_data
    end
    _sync_notify_parent action
  end

  def _sync_data(names = nil)
    unless names
      names = []
      self.class._sync_children_type.each do |name, type|
        names << name if type == :data
      end
    end
    ARPreload::Serializer.serialize self, *names
  end

  def _sync_notify_parent(action, path: nil, data: nil)
    self.class._sync_parents_inverse_of.each do |parent_name, inverse_name|
      parent = send parent_name
      next unless parent
      type = parent.class._sync_children_type[inverse_name]
      action2 = action
      if type == :many
        data2 = path ? data : _sync_data
        path2 = [[inverse_name, id], *path]
      else
        if path
          data2 = data
        else
          data2 = type == :data ? parent._sync_data([inverse_name])[inverse_name] : _sync_data
          action2 = :update
        end
        path2 = [[inverse_name], *path]
      end
      ARSync.sync_send to: parent, action: action2, path: path2, data: data2
      parent._sync_notify_parent action2, path: path2, data: data2
    end
  end

  def self.configure(&block)
    @sync_send_block = block
  end

  def self.sync_send(to:, action:, path:, data:)
    @sync_send_block.call to: to, action: action, path: path, data: data
  end

  def self.serialize(model, *args)
    ARPreload::Serializer.serialize model, *args
  end
end
