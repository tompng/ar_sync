require 'ar_serializer'
require_relative 'collection'
require_relative 'class_methods'
require_relative 'instance_methods'

module ArSync
  ArSync::ModelBase.module_eval do
    extend ActiveSupport::Concern
    include ArSync::ModelBase::InstanceMethods

    included do
      class_attribute :_sync_self, instance_accessor: false, default: false
    end
  end

  def self.on_notification(&block)
    @sync_send_block = block
  end

  def self.with_compact_notification
    key = :ar_sync_compact_notifications
    Thread.current[key] = []
    yield
  ensure
    events = Thread.current[key]
    Thread.current[key] = nil
    @sync_send_block&.call events if events.present?
  end

  def self.skip_notification?
    Thread.current[:ar_sync_skip_notification]
  end

  def self.without_notification
    key = :ar_sync_skip_notification
    flag_was = Thread.current[key]
    Thread.current[key] = true
    yield
  ensure
    Thread.current[key] = flag_was
  end

  def self.sync_send(to:, action:, model:, path: nil, field: nil, to_user: nil)
    key = sync_key to, to_user, signature: false
    e = { action: action }
    e[:field] = field if field
    if model
      e[:class_name] = model.class.base_class.name
      e[:id] = model.id
    end
    event = ["#{key}#{path}", e]
    buffer = Thread.current[:ar_sync_compact_notifications]
    if buffer
      buffer << event
    else
      @sync_send_block&.call [event]
    end
  end

  def self.sync_keys(model, user)
    [sync_key(model), sync_key(model, user)]
  end

  def self.sync_key(model, to_user = nil, signature: true)
    if model.is_a? ArSync::Collection
      key = [to_user&.id, model.klass.name, model.name].join '/'
    else
      key = [to_user&.id, model.class.name, model.id].join '/'
    end
    key = Digest::SHA256.hexdigest("#{config.key_secret}#{key}")[0, 32] if config.key_secret
    key = "#{config.key_prefix}#{key}" if config.key_prefix
    key = signature && config.key_expires_in ? signed_key(key, Time.now.to_i.to_s) : key
    key + ';/'
  end

  def self.validate_expiration(signed_key)
    signed_key = signed_key.to_s
    return signed_key unless config.key_expires_in
    key, time, signature, other = signed_key.split ';', 4
    return unless signed_key(key, time) == [key, time, signature].join(';')
    [key, other].compact.join ';' if Time.now.to_i - time.to_i < config.key_expires_in
  end

  def self.signed_key(key, time)
    "#{key};#{time};#{Digest::SHA256.hexdigest("#{config.key_secret}#{key};#{time}")[0, 16]}"
  end

  def self.serialize(record_or_records, query, user: nil)
    ArSerializer.serialize record_or_records, query, context: user, use: :sync
  end

  def self.sync_serialize(target, user, query)
    case target
    when ArSync::Collection, ArSync::ModelBase
      serialized = ArSerializer.serialize target, query, context: user, use: :sync
      return serialized if target.is_a? ArSync::ModelBase
      {
        sync_keys: ArSync.sync_keys(target, user),
        order: { mode: target.order, limit: target.limit },
        collection: serialized
      }
    when ActiveRecord::Relation, Array
      ArSync.serialize target.to_a, query, user: user
    when ArSerializer::Serializable
      ArSync.serialize target, query, user: user
    else
      target
    end
  end
end
