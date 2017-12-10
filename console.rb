require_relative 'model'
ARSync.configure do |to:, action:, path:, data:|
  msg = { to: to, action: action, path: path, data: data }.inspect
  puts "\e[1m#{msg}\e[m"
end

Star.last._sync_notify :update
Comment.last._sync_notify :update
ARSync.serialize Post.last, comments: :star_count;
binding.pry
