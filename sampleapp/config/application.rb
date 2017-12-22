require_relative 'boot'

require 'rails/all'

require 'ar_sync'

ARSync.configure do |key:, action:, path:, data:|
  ActionCable.server.broadcast key, action: action, path: path, data: data
end

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Sampleapp
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 5.1

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration should go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded.
  end
end
