require_relative 'boot'

require 'rails/all'

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

def sampleapp_ar_sync_mode
  ENV['SYNC_MODE'] == 'graph' ? :graph : :tree
end

def sampleapp_ar_sync_graph?
  sampleapp_ar_sync_mode == :graph
end

def sampleapp_ar_sync_tree?
  sampleapp_ar_sync_mode == :tree
end

module Sampleapp
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 5.1

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration should go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded.
    ArSync.use sampleapp_ar_sync_mode
  end
end
