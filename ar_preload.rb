require 'active_record'
module ARPreload
  extend ActiveSupport::Concern
  module ClassMethods
    def _preloadable_info
      @_preloadable_info ||= {}
    end

    def preloadable(*names, includes: nil, preload: nil, &data_block)
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
        _preloadable_info[name] = {
          includes: sub_includes,
          preloaders: preloaders,
          context_required: block.arity == preloaders.size + 1,
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
    def self.serialize(model, *args)
      last = args.last
      if last.is_a?(Hash) && (last.has_key?(:context) || last.has_key?(:include_id))
        last = last.dup
        context = last.delete :context
        include_id = last.delete :include_id
        args = args.dup
        args[-1] = last
      end
      output = {}
      _serialize [[model, output]], parse_args(args)[:attributes], context, include_id
      output
    end

    def self._serialize(value_outputs, attributes, context, include_id)
      value_outputs.group_by { |v, o| v.class }.each do |klass, value_outputs|
        next unless klass.respond_to? :_preloadable_info
        models = value_outputs.map(&:first)
        attributes.each_key do |name|
          unless klass._preloadable_info.has_key? name
            raise "No preloadable attribte `#{name}` for #{klass}"
          end
          includes = klass._preloadable_info[name][:includes]
          preload models, includes if includes.present?
        end

        preloaders = attributes.each_key.map { |name| klass._preloadable_info[name][:preloaders] }.flatten
        preloader_values = preloaders.compact.uniq.map do |preloader|
          if preloader.arity == 1
            [preloader, preloader.call(models)]
          else
            [preloader, preloader.call(models, context)]
          end
        end.to_h

        [[:id, {}], *attributes].each do |name, sub_arg|
          sub_calls = []
          column_name = sub_arg[:column_name] || name
          sub_attributes = sub_arg[:attributes]
          info = klass._preloadable_info[name]
          preloadeds = info[:preloaders]&.map(&preloader_values) || []
          data_block = info[:data]
          args = info[:context_required] ? [*preloadeds, context] : preloadeds
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
          _serialize sub_calls, sub_attributes, context, include_id if sub_attributes
        end
      end
    end

    def self.preload(*args)
      @preloader ||= ActiveRecord::Associations::Preloader.new
      @preloader.preload(*args)
    end

    def self.parse_args(args, only_attributes: false)
      attributes = {}
      column_name = nil
      (args.is_a?(Array) ? args : [args]).each do |arg|
        if arg.is_a?(Symbol) || arg.is_a?(String)
          attributes[arg.to_sym] = {}
        elsif arg.is_a? Hash
          arg.each do |key, value|
            if only_attributes
              attributes[key] = parse_args(value)
              next
            end
            if key == :as
              column_name = value
            elsif key == :attributes
              attributes.update parse_args(value, only_attributes: true)
            else
              attributes[key.to_sym] = parse_args(value)
            end
          end
        else
          raise "Arg type missmatch(Symbol, String or Hash): #{arg}"
        end
      end
      return attributes if only_attributes
      { attributes: attributes, column_name: column_name }
    end
  end
end
