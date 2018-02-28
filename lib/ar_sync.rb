module ARSync; end
require 'ar_sync/version'
require 'ar_sync/core'
require 'ar_sync/config'
require 'ar_sync/rails' if Kernel.const_defined?('Rails')
ActiveRecord::Base.include ARSync
