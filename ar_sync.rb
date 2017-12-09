module ARSync
  extend ActiveSupport::Concern
  module ClassMethods
    def sync_has_data(name, **option, &block)
      raise unless (option.keys - %i[includes preload]).empty?
      sync_children name, option.merge(type: :data), &block
    end

    def sync_has_one(name, **option, &block)
      raise unless (option.keys - %i[inverse_of]).empty?
      option = { type: :one, includes: name }.update option
      sync_children name, option, &block
    end

    def sync_has_many(name, **option, &block)
      raise unless (option.keys - %i[inverse_of]).empty?
      option = { type: :many, includes: name }.update option
      sync_children name, option, &block
    end

    def sync_children(name, **option, &data_block)
      raise unless (option.keys - %i[type inverse_of includes preload]).empty?
      data_block ||= name.to_sym.to_proc
      _sync_children_info[name] = option.merge data_block: data_block
    end

    def sync_self(&block)
      @sync_self_block = block || :sync_data.to_proc
    end

    def sync_belongs_to(parent, as:, includes: nil, preload: nil, &data_block)
      data_block ||= :sync_data.to_proc
      _sync_parents_info[parent] = {
        name: as,
        includes: includes,
        preload: preload,
        data_block: data_block || :sync_data.to_proc
      }
    end

    def _sync_self_block
      @sync_self_block
    end

    def _sync_parents_info
      @sync_parents ||= {}
    end

    def _sync_children_info
      @sync_children ||= {}
    end
  end
  included do
    %i[create update destroy].each do |action|
      after_commit(on: action) { _sync_notify action }
    end
  end

  def sync_includes
  end

  def sync_preload models
  end

  def sync_data
    as_json
  end

  def _sync_notify(action)
    sync_self_block = self.class._sync_self_block
    ARSync.sync_send to: self, action: action, path: [], data: instance_eval(&sync_self_block) if sync_self_block
    _sync_notify_parent action
  end

  def _sync_notify_parent(action, path: nil, data: nil)
    self.class._sync_parents_info.each do |parent_name, info|
      name = info[:name]
      data_block = info[:data_block]
      parent = send parent_name
      next unless parent
      info = parent.class._sync_children_info[name]
      child_data_block = info[:data_block]
      type = info[:type]
      action2 = action
      if type == :many
        data2 = path ? data : instance_eval(&data_block)
        path2 = [[name, id], *path]
      else
        if path
          data2 = data
        else
          if type == :data
            data2 = parent.instance_eval(&child_data_block)
          else
            data2 = instance_eval(&data_block)
          end
          action2 = :update
        end
        path2 = [[name], *path]
      end
      ARSync.sync_send to: parent, action: action2, path: path2, data: data2
      parent._sync_notify_parent action2, path: path2, data: data2
    end
  end

  def self.configure &block
    @sync_send_block = block
  end

  def self.sync_send(to:, action:, path:, data:)
    @sync_send_block.call to: to, action: action, path: path, data: data
  end

  module Serializer
    def self.serialize(model, *args)
      _serialize model, model.sync_data, parse_args(args)
    end

    def self._serialize(model, base_data, option)
      data = extract_data base_data, only: option[:only], except: option[:except]
      option[:children].each do |name, child_option|
        info = model.class._sync_children_info[name]
        child_data_block = info[:data_block]
        inverse_of = info[:inverse_of]
        type = info[:type]
        if type == :many
          data[name] = model.instance_eval(&child_data_block).map do |record|
            data_block = record.class._sync_parents_info[inverse_of][:data_block]
            _serialize record, record.instance_eval(&data_block), child_option
          end
        else
          child = model.instance_eval(&child_data_block)
          if type == :one
            data_block = child.class._sync_parents_info[inverse_of][:data_block]
            data[name] = _serialize child, child.instance_eval(&data_block), child_option
          else
            data[name] = child
          end
        end
      end
      data
    end

    def self.preload(*args)
      @preloader ||= ActiveRecord::Associations::Preloader.new
      @preloader.preload(*args)
    end

    def self.parse_args(args)
      parsed = {
        only: nil,
        except: nil,
        children: {}
      }
      Array(args).each do |arg|
        if arg.is_a? Symbol
          parsed[:children][arg] = { children: [] }
        elsif arg.is_a? Hash
          arg.each do |key, value|
            if %i[only except].include? key
              parsed[key] = Array value
            else
              parsed[:children][key] = parse_args value
            end
          end
        else
          raise 'Arg type missmatch(Symbol or Hash)'
        end
      end
      parsed
    end

    def self.extract_data(data, only:, except:)
      if only
        set = Array(only).map { |key| [key, true] }
        data = data.select { |k, _v| set[k] }
      end
      if except
        set = Array(except).map { |key| [key, true] }
        data = data.reject { |k, _v| set[k] }
      end
      data
    end
  end
end
