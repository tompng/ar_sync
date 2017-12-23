# ARSync
Your ActiveRecord Model will be synchronized with frontend javascript.

- Provides an json api with query(shape of the json)
- Send a diff of the json with ActionCable and applies to the json

## Installation

1. Add this line to your application's Gemfile:
```ruby
gem 'ar_sync', github: 'tompng/ar_sync'
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
  sync_self
  sync_data :name
  sync_has_many :posts
end

class Post < ApplicationRecord
  belongs_to :user
  ...
  sync_self
  sync_data :title, :body, :created_at, :updated_at
  sync_parent :user, inverse_of: :posts
end
```

2. Define apis
```ruby
# app/controllers/sync_api_controller.rb
class SyncApiController < ApplicationController
  include ARSync::ApiControllerConcern
  api :my_simple_user_api do |params|
    User.where(condition).find params[:id]
  end
end
```

3. write your view
```html
<!-- if you're using vue -->
<script>
  new ARSyncData({
    user: {
      api: 'my_simple_user_api',
      params: { id: location.hash.match(/\d+/)[0] },
      query: ['id', 'name', { posts: ['title', 'created_at'] }]
    }
  }).load((vueData) => {
    new Vue({ el: '#foobar', data: vueData })
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

Now, your view and ActiveRecord are synchronized.

In the sample above, clicking `Create Here` will add a new link to the created post immediately.
