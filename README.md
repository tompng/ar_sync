# ArSync — Reactive data sync for Ruby on Rails

Keep frontend JSON in sync with ActiveRecord, automatically.

- A read API where the client requests the shape of the JSON (built on [ar_serializer](https://github.com/tompng/ar_serializer)).
- When a record changes, a notification is pushed (over ActionCable) and the data on the client updates in place.
- Generates TypeScript types so query results are fully typed.

## Installation

Add the gem:

```ruby
gem 'ar_sync'
```

Run the generator (creates `SyncSchema`, the API controller, an ActionCable channel, an initializer, and routes):

```shell
rails g ar_sync:install
```

## Defining sync models

Declare which fields and associations are synced, and how change notifications
propagate to parents.

```ruby
class User < ApplicationRecord
  has_many :posts
  sync_has_data :id, :name
  sync_has_many :posts
end

class Post < ApplicationRecord
  belongs_to :user
  sync_parent :user, inverse_of: :posts
  sync_has_data :id, :title, :body, :createdAt, :updatedAt
  sync_has_one :user, only: [:id, :name]
end
```

DSL:

- `sync_has_data` / `sync_has_one` / `sync_has_many` — fields and associations to sync.
- `sync_parent parent, inverse_of:` — when this record changes, notify `parent` through its `inverse_of` field. Options:
  - `only_to:` — notify only a specific user (Symbol/Proc).
  - `watch:` — fire only when the given column (or Proc value) actually changes.

Field options (`type:`, `includes:`, `preload:`, `only:`, `except:`, `count_of:`, `permission:`, …) are passed through to ar_serializer — see its [README](https://github.com/tompng/ar_serializer) for the full list.

## Defining APIs (`SyncSchema`)

Root entry points live in `app/models/sync_schema.rb`. A field whose name matches
a model class and takes `ids:` is the **reload API** for that type, used when the
client subscribes by id — put your authorization there.

```ruby
class SyncSchema < ArSync::SyncSchemaBase
  serializer_field :my_profile do |current_user|
    current_user
  end

  serializer_field :my_friends do |current_user, age:|
    current_user.friends.where(age: age)
  end

  # Reload APIs (field name = class name, params = `ids:`)
  serializer_field :User do |current_user, ids:|
    User.where(accessible_condition).where id: ids
  end

  serializer_field :Post do |current_user, ids:|
    Post.where(accessible_condition).where id: ids
  end
end
```

## Frontend (TypeScript + React)

1. Add the package:

```jsonc
// package.json
"ar_sync": "github:tompng/ar_sync"
```

2. Generate types into a directory:

```shell
rails g ar_sync:types path/to/generated/
```

3. Configure the connection adapter once at startup:

```ts
import ArSyncModel from 'path/to/generated/ArSyncModel'
import ActionCableAdapter from 'ar_sync/core/ActionCableAdapter'
import * as ActionCable from 'actioncable'

ArSyncModel.setConnectionAdapter(new ActionCableAdapter(ActionCable))
// Pass a custom adapter instead if you use another transport.
```

4. Fetch data with hooks. The result type is derived from the query — only the
fields you ask for are present.

```tsx
import { useArSyncModel, useArSyncFetch } from 'path/to/generated/hooks'

const Hello: React.FC = () => {
  // useArSyncModel: fetch + subscribe to realtime updates
  const [user] = useArSyncModel({ api: 'my_profile', query: ['id', 'name'] })
  if (!user) return <>loading...</>
  // user.id    // => number
  // user.name  // => string
  // user.foo   // => compile error
  return <h1>Hello, {user.name}!</h1>
}
```

- `useArSyncModel` — fetch once, then keep the data live as the server changes.
- `useArSyncFetch` — fetch once without subscribing.

Queries follow ar_serializer's query format, e.g.
`{ id: true, name: true, posts: ['title', 'createdAt'] }`.

> Non-React frontends can use `ArSyncModel` directly (`new ArSyncModel({ api, query })`, `model.data`, `model.onload(...)`).

## Example app

https://github.com/tompng/ar_sync_sampleapp

## License

[MIT](LICENSE.txt)
