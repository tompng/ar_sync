const { ArSyncModel } = require('./vendor/assets/javascripts/ar_sync_model')
module.exports = {
  ArSyncModel,
  ArSyncStore: require('./vendor/assets/javascripts/ar_sync_store'),
  staticApiFetch: require('./vendor/assets/javascripts/ar_static_api_fetch')
}
