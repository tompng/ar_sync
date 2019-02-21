require 'ostruct'
module ArSync
  config_keys = %i[
    current_user_method
    key_secret
    key_prefix
  ]
  Config = Struct.new(*config_keys)

  def self.config
    @config ||= Config.new :current_user, nil, nil
  end

  def self.configure
    yield config
  end
end
