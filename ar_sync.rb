require_relative 'ar_preload'
module ARSync
  extend ActiveSupport::Concern
  module ClassMethods
    def sync_has_data(name, **option, &data_block)
      raise unless (option.keys - %i[includes preload]).empty?
      data_block ||= _sync_data_block_fallback name
      _sync_children name, option.merge(type: :data), &data_block
      preloadable name, option, &data_block
    end

    def sync_has_one(name, **option, &data_block)
      raise unless (option.keys - %i[inverse_of]).empty?
      option = { type: :one, includes: name }.update option
      data_block ||= _sync_data_block_fallback name
      _sync_children name, option, &data_block
      preloadable name, includes: name, &data_block
    end

    def sync_has_many(name, **option, &data_block)
      raise unless (option.keys - %i[inverse_of]).empty?
      option = { type: :many, includes: name }.update option
      data_block ||= _sync_data_block_fallback name
      _sync_children name, option, &data_block
      preloadable name, includes: name, &data_block
    end

    def _sync_data_block_fallback(name)
      ->(_preload = nil) { send name }
    end

    def _sync_children(name, **option, &data_block)
      _sync_children_info[name] = option.merge data_block: data_block
    end

    def sync_self
      @sync_self = true
    end

    def sync_belongs_to(parent, as:, includes: nil, preload: nil)
      _sync_parents_info[parent] = {
        name: as,
        includes: includes,
        preload: preload
      }
    end

    def _sync_self?
      @sync_self
    end

    def _sync_parents_info
      @sync_parents ||= {}
    end

    def _sync_children_info
      @sync_children ||= {}
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

  def _sync_data
    data = {}
    self.class._sync_children_info.each do |name, info|
      data[name] = _sync_data_for name if info[:type] == :data
    end
    data
  end

  def _sync_data_for(name)
    info = self.class._sync_children_info[name]
    data_block = info[:data_block]
    includes = info[:includes]
    preloader = info[:preload]
    ARPreload::Serializer.preload self, includes if includes
    if preloader
      instance_exec(preloader.call([self]), &data_block)
    else
      instance_exec(&data_block)
    end
  end

  def _sync_notify_parent(action, path: nil, data: nil)
    self.class._sync_parents_info.each do |parent_name, info|
      name = info[:name]
      parent = send parent_name
      next unless parent
      inverse_info = parent.class._sync_children_info[name]
      type = inverse_info[:type]
      action2 = action
      if type == :many
        data2 = path ? data : _sync_data
        path2 = [[name, id], *path]
      else
        if path
          data2 = data
        else
          data2 = type == :data ? parent._sync_data_for(name) : _sync_data
          action2 = :update
        end
        path2 = [[name], *path]
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
