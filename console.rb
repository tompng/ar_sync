require_relative 'model'
ARSync.configure do |to:, action:, path:, data:|
  msg = { to: to, action: action, path: path, data: data }.inspect
  puts "\e[1m#{msg}\e[m"
end
binding.pry
