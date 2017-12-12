require_relative 'ar_preload'
module ARSync
  extend ActiveSupport::Concern
  module ClassMethods
    def sync_has_data(name, includes: nil, preload: nil, &data_block)
      _sync_children name, type: :data
      data_block ||= _sync_data_block_fallback name
      preloadable name, { includes: includes, preload: preload }, &data_block
    end

    def sync_has_one(name, &data_block)
      _sync_children name, type: :one
      data_block ||= _sync_data_block_fallback name
      preloadable name, &data_block
    end

    def sync_has_many(name, &data_block)
      _sync_children name, type: :many
      data_block ||= _sync_data_block_fallback name
      preloadable name, &data_block
    end

    def _sync_data_block_fallback(name)
      ->(_preload = nil) { send name }
    end

    def _sync_children(name, **option)
      _sync_children_info[name] = option
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

    def _sync_children_info
      @_sync_children_info ||= {}
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
      self.class._sync_children_info.each do |name, info|
        names << name if info[:type] == :data
      end
    end
    ARPreload::Serializer.serialize self, *names
  end

  def _sync_notify_parent(action, path: nil, data: nil)
    self.class._sync_parents_inverse_of.each do |parent_name, inverse_name|
      parent = send parent_name
      next unless parent
      inverse_info = parent.class._sync_children_info[inverse_name]
      type = inverse_info[:type]
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
