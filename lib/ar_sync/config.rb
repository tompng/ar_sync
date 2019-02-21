require 'ostruct'
module ArSync
  config_keys = %i[
    key_secret
    key_prefix
    current_user_method
  ]
  class Config < Struct.new(*config_keys); end

  def self.config
    @config ||= Config.new current_user_method: :current_user
  end

  def self.configure
    yield config
  end
end
