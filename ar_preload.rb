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

require_relative 'model'
class User
  include ARPreload
  preloadable :id, :name
  preloadable :posts, includes: :posts
end

class Post
  include ARPreload
  preloadable :id, :title, :body
  preloadable :user, includes: :user
  preloadable :comments, includes: :comments
  preloadable :comment_count, preload: lambda { |posts|
    Comment.where(post_id: posts.map(&:id)).group(:post_id).count
  } do |preload|
    preload[id] || 0
  end
end

class Comment
  include ARPreload
  preloadable :id, :body
  preloadable :user, includes: :user
  preloadable :stars_count, preload: lambda { |comments|
    Star.where(comment_id: comments.map(&:id)).group(:comment_id).count
  } do |preload|
    preload[id] || 0
  end
  preloadable :stars, includes: :stars
end

class Star
  include ARPreload
  preloadable :user, includes: :user
end

ARPreload::Serializer.serialize User.first, :id, posts: { comments: :stars_count }
# User Load (0.2ms)  SELECT  "users".* FROM "users" ORDER BY "users"."id" ASC LIMIT ?  [["LIMIT", 1]]
# Post Load (0.3ms)  SELECT "posts".* FROM "posts" WHERE "posts"."user_id" = 1
# Comment Load (2.9ms)  SELECT "comments".* FROM "comments" WHERE "comments"."post_id" IN (1, 7, 8, 10, 15)
#  (0.2ms)  SELECT COUNT(*) AS count_all, "stars"."comment_id" AS stars_comment_id FROM "stars" WHERE "stars"."comment_id" IN (22, 29, 35, 60, 16, 62, 64, 5, 26, 30, 31, 40, 46) GROUP BY "stars"."comment_id"
# => {:id=>1,
#  :posts=>
#   [{:comments=>[{:stars_count=>4}, {:stars_count=>3}, {:stars_count=>3}]},
#    {:comments=>[{:stars_count=>2}]},
#    {:comments=>[{:stars_count=>0}, {:stars_count=>2}, {:stars_count=>2}]},
#    {:comments=>[{:stars_count=>1}, {:stars_count=>5}, {:stars_count=>3}, {:stars_count=>2}]},
#    {:comments=>[{:stars_count=>4}, {:stars_count=>3}]}]}

binding.pry
