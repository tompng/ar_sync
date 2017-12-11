require 'active_record'
module ARPreload
  extend ActiveSupport::Concern
  module ClassMethods
    def preloadable_info
      @preloadable_info ||= {}
    end

    def preloadable(*names, includes: nil, preload: nil, &preload_block)
      if preload
        preloaders = Array(preload).map do |preloader|
          next preloader if preloader.is_a? Proc
          raise "preloader not found: #{preloader}" unless custom_preloaders.has_key?(preloader)
          custom_preloaders[preloader]
        end
      end
      names.each do |name|
        includes = name if includes.nil? && reflect_on_association(name)
        preloadable_info[name] = {
          includes: includes,
          preloaders: preloaders,
          data: preload_block
        }
      end
    end

    def custom_preloaders
      @custom_preloaders ||= {}
    end

    def custom_preloader(name, &block)
      custom_preloaders[name] = block
    end
  end

  module Serializer
    def self.serialize(model, *args)
      output = {}
      _serialize [[model, output]], parse_args(args)
      output
    end

    def self._serialize(value_outputs, arg)
      value_outputs.group_by { |v, o| v.class }.each do |klass, value_outputs|
        next unless klass.respond_to? :preloadable_info
        models = value_outputs.map(&:first)
        arg.each_key do |name|
          includes = klass.preloadable_info[name][:includes]
          preload models, includes if includes.present?
        end

        preloaders = []
        arg.each_key do |name|
          preloaders << klass.preloadable_info[name][:preloaders]
        end
        preloader_values = preloaders.flatten.compact.uniq.map do |preloader|
          [preloader, preloader.call(models)]
        end.to_h

        arg.each do |name, sub_arg|
          sub_calls = []
          info = klass.preloadable_info[name]
          value_outputs.each do |value, output|
            if info[:data]
              if info[:preloaders]
                preloadeds = info[:preloaders].map { |preloader| preloader_values[preloader] }
                child = value.instance_exec(*preloadeds, &info[:data])
              else
                child = value.instance_exec(&info[:data])
              end
            else
              child = value.send name
            end
            if child.is_a? ActiveRecord::Relation
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
          _serialize sub_calls, sub_arg
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
