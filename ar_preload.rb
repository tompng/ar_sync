require 'active_record'
module ARPreload
  extend ActiveSupport::Concern
  module ClassMethods
    def preloadable_info
      @preloadable_info ||= {}
    end

    def preloadable *names, includes: nil, preload: nil, &preload_block
      names.each do |name|
        preloadable_info[name] = {
          includes: includes,
          preload: preload,
          data: preload_block
        }
      end
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
        arg.each do |name, sub_arg|
          info = klass.preloadable_info[name]
          includes = Array info[:includes]
          models = value_outputs.map(&:first)
          preload models, includes unless includes.empty?
          preloaded = info[:preload].call models if info[:preload]
          sub_calls = []
          value_outputs.each do |value, output|
            if info[:data]
              child = value.instance_exec(preloaded, &info[:data])
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
