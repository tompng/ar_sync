# ArSync - Reactive Programming with Ruby on Rails

Frontend JSON data will be synchronized with ActiveRecord.

- Provides an json api with query(shape of the json)
- Send a diff of the json with ActionCable and applies to the json

## Installation

1. Add this line to your application's Gemfile:
```ruby
gem 'ar_sync', github: 'tompng/ar_sync'
gem 'ar_serializer', github: 'tompng/ar_serializer'
# gem 'top_n_loader', github: 'tompng/top_n_loader' (optional)
```

2. Run generator
```shell
rails g ar_sync:install
```

## Usage

1. Define parent, data, has_one, has_many to your models
```ruby
class User < ApplicationRecord
  has_many :posts
  ...
  sync_field :name, :posts
end

class Post < ApplicationRecord
  belongs_to :user
  ...
  sync_field :title, :body, :created_at, :updated_at
  sync_parent :user, inverse_of: :posts
end
```

2. Define apis
```ruby
# app/controllers/sync_api_controller.rb
class SyncApiController < ApplicationController
  include ArSync::ApiControllerConcern
  api User do |ids|
    User.where(curren_user_can_view).where id: ids
  end
  api Post do |ids|
    Post.where(curren_user_can_view).where id: ids
  end
  api :profile do
    current_user
  end
end
```

3. write your view
```html
<!-- if you're using vue -->
<script>
  ArSyncModel.load({
    api: 'User',
    id: 3,
    query: ['id', 'sync_keys', 'name', { posts: ['sync_keys', 'title', 'created_at'] }]
  }).then((userModel) => {
    new Vue({ el: '#foobar', data: { user: userModel.data } })
  })
</script>
<div id='foobar'>
  <h1>{{user.name}}'s page</h1>
  <ul>
    <li v-for='post in user.posts'>
      <a :href="'/posts/' + post.id">
        {{post.title}}
      </a>
      <small>date: {{post.created_at}}</small>
    </li>
  </ul>
  <a :href="'/posts/create_random_post?user_id=' + user.id" data-remote=true data-method=post>
    Click Here
  </a> to create a new post with random title and body
</div>
```
