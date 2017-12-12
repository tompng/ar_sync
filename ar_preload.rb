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
        includes = name if includes.nil? && reflect_on_association(name)
        block = data_block || ->() { send name }
        _preloadable_info[name] = {
          includes: includes,
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
      args = args.dup
      context = args.last.is_a?(Hash) && args.last.delete(:context)
      output = {}
      _serialize [[model, output]], parse_args(args), context
      output
    end

    def self._serialize(value_outputs, arg, context)
      value_outputs.group_by { |v, o| v.class }.each do |klass, value_outputs|
        next unless klass.respond_to? :_preloadable_info
        models = value_outputs.map(&:first)
        arg.each_key do |name|
          includes = klass._preloadable_info[name][:includes]
          preload models, includes if includes.present?
        end

        preloaders = arg.each_key.map { |name| klass._preloadable_info[name][:preloaders] }.flatten
        preloader_values = preloaders.compact.uniq.map do |preloader|
          if preloader.arity == 1
            [preloader, preloader.call(models)]
          else
            [preloader, preloader.call(models, context)]
          end
        end.to_h

        arg.each do |name, sub_arg|
          sub_calls = []
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
                data = {}
                array << data
                sub_calls << [record, data]
              end
              output[name] = array
            elsif child.is_a? ActiveRecord::Base
              data = {}
              sub_calls << [child, data]
              output[name] = data
            else
              output[name] = child
            end
          end
          _serialize sub_calls, sub_arg, context
        end
      end
    end

    def self.preload(*args)
      @preloader ||= ActiveRecord::Associations::Preloader.new
      @preloader.preload(*args)
    end

    def self.parse_args(args)
      parsed = {}
      (args.is_a?(Array) ? args : [args]).each do |arg|
        if arg.is_a? Symbol
          parsed[arg] = {}
        elsif arg.is_a? Hash
          arg.each do |key, value|
            parsed[key] = parse_args value
          end
        else
          raise "Arg type missmatch(Symbol or Hash): #{arg}"
        end
      end
      parsed
    end
  end
end
