module ARSync; end
require 'ar_sync/version'
require 'ar_sync/ar_preload'
require 'ar_sync/core'
require 'ar_sync/config'
require 'ar_sync/rails/engine' if Kernel.const_defined?('Rails')
ActiveRecord::Base.class_eval do
  include ARSync
end
