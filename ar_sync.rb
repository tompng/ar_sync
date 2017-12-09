module ARSync
  extend ActiveSupport::Concern
  def self.sync_has_one(name, inverse_of: nil, &block)
    sync_children name, inverse_of: inverse_of, multiple: false, &block
  end

  def self.sync_has_many(name, inverse_of:, &block)
    sync_children name, inverse_of: inverse_of, multiple: true, &block
  end

  def self.sync_children(name, inverse_of:, multiple:, &data_block)
    data_block ||= name.to_sym.to_proc
    @sync_children ||= {}
    @sync_children[name] = [data_block, inverse_of, multiple]
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

  def self._sync_parents_info
    @sync_parents
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
      child_data_block, _inverse_of, multiple = parent.class._sync_children_info[name]
      action2 = action
      if multiple
        data = instance_exec(&data_block) if path.nil?
        path2 = [[name, id], *path]
      else
        path2 = [[name], *path]
        if path
          data2 = data
        else
          data2 = instance_exec(&(data_block || child_data_block))
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

  module Serializer
    def self.serialize model, *args
      _serialize(model, model.sync_data, parse_args(args))
    end

    def self._serialize(model, base_data, option)
      data = extract_data base_data, only: option[:only], except: option[:except]
      option[:children].each do |name, option|
        child_data_block, inverse_of, multiple = model.class._sync_children_info[name]
        if multiple
          data[name] = model.instance_exec(&child_data_block).map do |record|
            _name, data_block = record.class._sync_parents_info[inverse_of]
            serialize record, record.instance_exec(&data_block), option
          end
        else
          child = child_data_block.call
          if child.class.respond_to? :_sync_parents_info
            _name, data_block = child.class._sync_parents_info[inverse_of]
            data[name] = serialize child, child.instance_exec(&data_block), option
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
          raise "Arg type missmatch(Symbol or Hash)"
        end
      end
      parsed
    end

    def extract_data(data, only:, except:)
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
