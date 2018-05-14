const { ArSyncModel } = require('./vendor/assets/javascripts/ar_sync_model')
module.exports = {
  ArSyncModel,
  ArSyncStore: require('./vendor/assets/javascripts/ar_sync_store'),
  ArSyncAPI: require('./vendor/assets/javascripts/ar_sync_api_fetch')
}
