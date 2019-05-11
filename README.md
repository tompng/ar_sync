# ArSync - Reactive Programming with Ruby on Rails

Frontend JSON data will be synchronized with ActiveRecord.

- Provides an json api with query(shape of the json)
- Send a notificaiton with ActionCable and automaticaly updates the data

## Installation

1. Add this line to your application's Gemfile:
```ruby
gem 'ar_sync'
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
  sync_has_data :id, :name
  sync_has_many :posts
end

class Post < ApplicationRecord
  belongs_to :user
  ...
  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body, :createdAt, :updatedAt
  sync_has_one :user, only: [:id, :name]
end
```

2. Define apis
```ruby
# app/controllers/sync_api_controller.rb
class SyncApiController < ApplicationController
  include ArSync::ApiControllerConcern
  # User-defined api
  serializer_field :my_simple_profile_api do |current_user|
    current_user
  end
  serializer_field :my_simple_user_api do |current_user, id:|
    User.where(condition).find id
  end
  # Reload api (field name = classname, params = `ids:`)
  serializer_field :User do |current_user, ids:|
    User.where(condition).where id: ids
  end
  serializer_field :Post do |current_user, ids:|
    Post.where(condition).where id: ids
  end
end
```

3. Write your view
```html
<!-- if you're using vue -->
<script>
  const userModel = new ArSyncModel({
    api: 'my_simple_profile_api ',
    query: { id: true, name: true, posts: ['title', 'createdAt'] }
  })
  userModel.onload(() => {
    new Vue({ el: '#root', data: { user: userModel.data } })
  })
</script>
<div id='root'>
  <h1>{{user.name}}'s page</h1>
  <ul>
    <li v-for='post in user.posts'>
      <a :href="'/posts/' + post.id">
        {{post.title}}
      </a>
      <small>date: {{post.createdAt}}</small>
    </li>
  </ul>
  <form action='/posts' data-remote=true method=post>
    <input name='post[title]'>
    <textarea name=post[body]></textarea>
    <input type=submit>
  </form>
</div>
```
Now, your view and ActiveRecord are synchronized.


# With typescript
1. Add `"ar_sync": "git://github.com/tompng/ar_sync.git"` to your package.json

2. Generate types
```shell
rails g ar_sync:types path_to_generated_code_dir/
```

3. Connection Setting
```ts
import ArSyncModel from 'path_to_generated_code_dir/ArSyncModel'
import ActionCableAdapter from 'ar_sync/core/ActionCableAdapter'
ArSyncModel.setConnectionAdapter(new ActionCableAdapter)
// ArSyncModel.setConnectionAdapter(new MyCustomConnectionAdapter) // If you are using other transports
```

4. Write your components
```ts
import { useArSyncModel } from 'path_to_generated_code_dir/hooks'
const HelloComponent: React.FC = () => {
  const [user, status] = useArSyncModel({
    api: 'my_simple_profile_api',
    query: ['id', 'name']
  })
  // user // => { id: number; name: string } | null
  if (!user) return <>loading...</>
  // user.id // => number
  // user.name // => string
  // user.foobar // => compile error
  return <h1>Hello, {user.name}!</h1>
}
```

# Examples
https://github.com/tompng/ar_sync_sampleapp
