const { ArSyncModel, ArSyncCollection } = require('./vendor/assets/javascripts/ar_sync_store')
require('./vendor/assets/javascripts/ar_sync_data_adapter')
module.exports = {
  ArSyncModel,
  ArSyncCollection,
  fetchSyncAPI: require('./vendor/assets/javascripts/ar_sync_fetch')
}
