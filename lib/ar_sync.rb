module ArSync
  module GraphSync; end
  module TreeSync; end
  def self.use(mode, klass: ActiveRecord::Base)
    case mode
    when :tree
      if klass.ancestors.include? ArSync::GraphSync
        raise ArgumentError, 'already activated ArSync::GraphSync'
      end
      klass.include ArSync::TreeSync
    when :graph
      if klass.ancestors.include? ArSync::TreeSync
        raise ArgumentError, 'already activated ArSync::TreeSync'
      end
      klass.include ArSync::GraphSync
    else
      raise ArgumentError, 'argument should be :tree or :graph'
    end
  end
end
require 'ar_sync/version'
require 'ar_sync/core'
require 'ar_sync/config'
require 'ar_sync/rails' if Kernel.const_defined?('Rails')
