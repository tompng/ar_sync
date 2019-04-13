def sampleapp_ar_sync_mode
  ENV['SYNC_MODE'] == 'graph' ? :graph : :tree
end

def sampleapp_ar_sync_graph?
  sampleapp_ar_sync_mode == :graph
end

def sampleapp_ar_sync_tree?
  sampleapp_ar_sync_mode == :tree
end

ArSync.use sampleapp_ar_sync_mode
ArSync.configure do |config|
  config.current_user_method = :current_user
  config.key_prefix = 'ar_sync_'
  config.key_secret = '0123456789abcdef0123456789abcdef'
  config.key_expires_in = 3.seconds
end
