require 'pry'
require_relative 'db'
require_relative 'ar_sync'

class User < ActiveRecord::Base
  include ARSync
  has_many :posts
  sync_self
  sync_has_many :posts, inverse_of: :user
end

class Post < ActiveRecord::Base
  include ARSync
  belongs_to :user
  has_many :comments
  sync_self
  sync_belongs_to :user, as: :posts
  sync_has_many :comments, inverse_of: :post
end

class Comment < ActiveRecord::Base
  include ARSync
  belongs_to :user
  belongs_to :post
  has_many :stars
  sync_self
  sync_belongs_to :post, as: :comments
  sync_has_data(:star_count) { stars.size }
end

class Star < ActiveRecord::Base
  include ARSync
  belongs_to :user
  belongs_to :comment
  sync_belongs_to :comment, as: :star_count
end
