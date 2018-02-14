require 'active_record'
module ARSync::ARPreload
  extend ActiveSupport::Concern

  module Util
    def self.block_has_keyword_arg?(block, keyword, allow_keyrest: true)
      block.parameters.any? do |type, name|
        next true if allow_keyrest && type == :keyrest
        (type == :key || type == :keyreq) && name == keyword
      end
    end
  end

  module ClassMethods
    def _preloadable_field_info
      @_preloadable_field_info ||= {}
    end

    def preloadable_field(*names, includes: nil, preload: nil, overwrite: true, &data_block)
      if preload
        preloaders = Array(preload).map do |preloader|
          next preloader if preloader.is_a? Proc
          raise "preloader not found: #{preloader}" unless _custom_preloaders.has_key?(preloader)
          _custom_preloaders[preloader]
        end
      end
      preloaders ||= []
      names.each do |name|
        sub_includes = includes || (name if reflect_on_association(name))
        block = data_block || ->() { send name }
        key = name.to_s
        next if !overwrite && _preloadable_field_info.key?(key)
        _preloadable_field_info[key] = {
          includes: sub_includes,
          preloaders: preloaders,
          accepts: {
            context: Util.block_has_keyword_arg?(block, :context),
            param: Util.block_has_keyword_arg?(block, :param)
          },
          data: block
        }
      end
    end

    def _custom_preloaders
      @_custom_preloaders ||= {}
    end

    def define_preloader(name, &block)
      _custom_preloaders[name] = block
    end
  end

  module Serializer
    def self.serialize(model, args, context: nil, include_id: false, prefix: nil)
      if model.is_a?(ActiveRecord::Base)
        output = {}
        _serialize [[model, output]], parse_args(args), context, include_id, prefix
        output
      else
        sets = model.to_a.map do |record|
          [record, {}]
        end
        _serialize sets, parse_args(args), context, include_id, prefix
        sets.map(&:last)
      end
    end

    def self._serialize(mixed_value_outputs, args, context, include_id, prefix)
      attributes = args[:attributes]
      params = args[:params]
      mixed_value_outputs.group_by { |v, o| v.class }.each do |klass, value_outputs|
        next unless klass.respond_to? :_preloadable_field_info
        models = value_outputs.map(&:first)
        attributes.each_key do |name|
          prefixed_name = "#{prefix}#{name}"
          unless klass._preloadable_field_info.has_key? prefixed_name
            raise "No preloadable field `#{name}`#{" prefix: #{prefix}" if prefix} for #{klass}"
          end
          includes = klass._preloadable_field_info[prefixed_name][:includes]
          preload models, includes if includes.present?
        end

        preloaders = attributes.each_key.map { |name| klass._preloadable_field_info["#{prefix}#{name}"][:preloaders] }.flatten
        preloader_values = preloaders.compact.uniq.map do |preloader|
          arg_hash = {}
          arg_hash[:context] = context if Util.block_has_keyword_arg?(preloader, :context)
          arg_hash[:params] = params if Util.block_has_keyword_arg?(preloader, :params)
          [preloader, preloader.call(models, **arg_hash)]
        end.to_h

        (include_id ? [[:id, {}], *attributes] : attributes).each do |name, sub_arg|
          sub_calls = []
          column_name = sub_arg[:column_name] || name
          prefixed_name = "#{prefix}#{name}"
          info = klass._preloadable_field_info[prefixed_name]
          args = info[:preloaders]&.map(&preloader_values) || []
          data_block = info[:data]
          arg_hash = {}
          arg_hash[:context] = context if info[:accepts][:context]
          arg_hash[:params] = params if info[:accepts][:params]
          args << arg_hash unless arg_hash.empty?
          value_outputs.each do |value, output|
            child = value.instance_exec(*args, &data_block)
            is_array_of_model = child.is_a?(Array) && child.grep(ActiveRecord::Base).size == child.size
            if child.is_a?(ActiveRecord::Relation) || is_array_of_model
              array = []
              child.each do |record|
                data = include_id ? { id: record.id } : {}
                array << data
                sub_calls << [record, data]
              end
              output[column_name] = array
            elsif child.is_a? ActiveRecord::Base
              data = include_id ? { id: child.id } : {}
              sub_calls << [child, data]
              output[column_name] = data
            else
              output[column_name] = child
            end
          end
          _serialize sub_calls, sub_arg, context, include_id, prefix if sub_arg[:attributes]
        end
      end
    end

    def self.preload(*args)
      @preloader ||= ActiveRecord::Associations::Preloader.new
      @preloader.preload(*args)
    end

    def self.parse_args(args, only_attributes: false)
      attributes = {}
      params = nil
      column_name = nil
      (args.is_a?(Array) ? args : [args]).each do |arg|
        if arg.is_a?(Symbol) || arg.is_a?(String)
          attributes[arg.to_sym] = {}
        elsif arg.is_a? Hash
          arg.each do |key, value|
            sym_key = key.to_sym
            if only_attributes
              attributes[sym_key] = parse_args(value)
              next
            end
            if sym_key == :as
              column_name = value
            elsif sym_key == :attributes
              attributes.update parse_args(value, only_attributes: true)
            elsif sym_key == :params
              params = value
            else
              attributes[sym_key] = parse_args(value)
            end
          end
        else
          raise "Arg type missmatch(Symbol, String or Hash): #{arg}"
        end
      end
      return attributes if only_attributes
      { attributes: attributes, column_name: column_name, params: params }
    end
  end
end
