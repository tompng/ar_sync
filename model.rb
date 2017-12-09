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
  sync_self
  sync_belongs_to :post, as: :comments
end

binding.pry
