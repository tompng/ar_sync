module ARSync
  extend ActiveSupport::Concern
  module ClassMethods
    def sync_has_data(name, &block)
      sync_children name, inverse_of: nil, type: :data, &block
    end

    def sync_has_one(name, inverse_of: nil, &block)
      sync_children name, inverse_of: inverse_of, type: :one, &block
    end

    def sync_has_many(name, inverse_of:, &block)
      sync_children name, inverse_of: inverse_of, type: :many, &block
    end

    def sync_children(name, inverse_of:, type:, &data_block)
      data_block ||= name.to_sym.to_proc
      _sync_children_info[name] = [data_block, inverse_of, type]
    end

    def sync_self(&block)
      @sync_self_block = block || :sync_data.to_proc
    end

    def sync_belongs_to(parent, as:, &data_block)
      data_block ||= :sync_data.to_proc
      _sync_parents_info[parent] = [as, data_block]
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

  def sync_data
    as_json
  end

  def _sync_notify(action)
    sync_self_block = self.class._sync_self_block
    ARSync.sync_send to: self, action: action, path: [], data: instance_eval(&sync_self_block) if sync_self_block
    _sync_notify_parent action
  end

  def _sync_notify_parent(action, path: nil, data: nil)
    self.class._sync_parents_info.each do |parent_name, (name, data_block)|
      parent = send parent_name
      next unless parent
      child_data_block, _inverse_of, type = parent.class._sync_children_info[name]
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
        child_data_block, inverse_of, type = model.class._sync_children_info[name]
        if type == :many
          data[name] = model.instance_eval(&child_data_block).map do |record|
            _name, data_block = record.class._sync_parents_info[inverse_of]
            _serialize record, record.instance_eval(&data_block), child_option
          end
        else
          child = model.instance_eval(&child_data_block)
          if type == :one
            _name, data_block = child.class._sync_parents_info[inverse_of]
            data[name] = _serialize child, child.instance_eval(&data_block), child_option
          else
            data[name] = child
          end
        end
      end
      data
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
