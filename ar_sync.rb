require_relative 'ar_preload'
module ARSync
  extend ActiveSupport::Concern
  module ClassMethods
    def sync_has_data(*names, **option, &data_block)
      _sync_define(:data, names, option, &data_block)
    end

    def sync_has_one(*names, **option, &data_block)
      _sync_define(:one, names, option, &data_block)
    end

    def sync_has_many(*names, **option, &data_block)
      _sync_define(:many, names, option, &data_block)
    end

    def _sync_define(type, names, option, &data_block)
      names.each do |name|
        _sync_children_type[name] = type
        block = data_block || ->(*_preloads) { send name }
        preloadable name, option, &block
      end
    end

    def sync_self
      @_sync_self = true
    end

    def sync_parent(parent, inverse_of:, only_to: nil)
      _sync_parents_info << [
        parent,
        { inverse_name: inverse_of, only_to: only_to }
      ]
    end

    def _sync_self?
      @_sync_self
    end

    def _sync_parents_info
      @_sync_parents_info ||= []
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

  def _sync_data(names = nil, to_user: nil, new_record: false)
    fallbacks = {}
    unless names
      names = []
      self.class._sync_children_type.each do |name, type|
        names << name if type == :data
        if new_record
          fallbacks[name] = [] if type == :many
          fallbacks[name] = nil if type == :one
        end
      end
    end
    data = ARPreload::Serializer.serialize self, *names, context: to_user
    fallbacks.update data
  end

  def _sync_notify_parent(action, path: nil, data: nil, only_to_user: nil)
    self.class._sync_parents_info.each do |parent_name, inverse_name:, only_to:|
      if only_to
        to_user = instance_exec(&only_to)
        next unless to_user
        next if only_to_user && only_to_user != to_user
      end
      parent = send parent_name
      next unless parent
      type = parent.class._sync_children_type[inverse_name]
      action2 = action
      if type == :many
        data2 = path ? data : _sync_data(new_record: action == :create)
        path2 = [[inverse_name, id], *path]
      elsif path
        data2 = data
        path2 = [[inverse_name], *path]
      else
        if type == :data
          action2 = :update
          data2 = parent._sync_data([inverse_name], to_user: to_user)
          path2 = []
        else
          data2 = _sync_data
          path2 = [[inverse_name]]
        end
      end
      ARSync.sync_send to: parent, action: action2, path: path2, data: data2, to_user: to_user || only_to_user
      parent._sync_notify_parent action2, path: path2, data: data2, only_to_user: to_user || only_to_user
    end
  end

  def self.configure(&block)
    @sync_send_block = block
  end

  def self.sync_send(to:, action:, path:, data:, to_user: nil)
    key = sync_key to, path.map(&:first), to_user
    @sync_send_block&.call key: key, action: action, path: path, data: data
  end

  def self.sync_key(model, path, to_user = nil)
    secret = ENV['SYNC_SECRET']
    key = [to_user&.id, model.class.name, model.id, path].join '_'
    return key unless secret
    Digest::SHA256.hexdigest secret + key
  end

  def self.sync_api(model, current_user, *args)
    paths = _extract_paths args
    keys = paths.flat_map do |path|
      [sync_key(model, path), sync_key(model, path, current_user)]
    end
    {
      keys: keys,
      data: ARPreload::Serializer.serialize(model, *args, context: current_user, include_id: true)
    }
  end

  def self._extract_paths(args)
    parsed = ARPreload::Serializer.parse_args args
    paths = []
    extract = lambda do |path, attributes|
      paths << path
      attributes.each do |key, value|
        sub_attributes = value[:attributes]
        next unless sub_attributes
        sub_path = [*path, key]
        extract.call sub_path, sub_attributes
      end
    end
    extract.call [], parsed[:attributes]
    paths
  end
end
