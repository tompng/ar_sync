const { ARSyncData, ARSyncImmutableData} = require('./vendor/assets/javascripts/ar_sync_data')

module.exports = {
  ARSyncStore: require('./vendor/assets/javascripts/ar_sync_store'),
  ARSyncData,
  ARSyncImmutableData,
  staticApiFetch: require('./vendor/assets/javascripts/ar_static_api_fetch')
}
