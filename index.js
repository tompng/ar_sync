const { ArSyncData, ArSyncImmutableData } = require('./vendor/assets/javascripts/ar_sync_data')
require('./vendor/assets/javascripts/ar_sync_data_adapter')
module.exports = {
  ArSyncStore: require('./vendor/assets/javascripts/ar_sync_store'),
  ArSyncData,
  ArSyncImmutableData,
  staticApiFetch: require('./vendor/assets/javascripts/ar_static_api_fetch')
}
