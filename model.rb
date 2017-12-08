class User < ActiveRecord::Base
  has_many :posts
  sync_has_many :posts
end

class Post < ActiveRecord::Base
  belongs_to :user
  has_many :comments
  sync_belongs_to :user, as: :posts
  sync_has_many :comments
end

class Comment < ActiveRecord::Base
  belongs_to :user
  belongs_to :post
  sync_belongs_to :post, as: :comments
end
