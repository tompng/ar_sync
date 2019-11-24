module ArSync
  module ModelBase; end
end
require 'ar_sync/version'
require 'ar_sync/core'
require 'ar_sync/config'
require 'ar_sync/type_script'
require 'ar_sync/rails' if Kernel.const_defined?('Rails')
