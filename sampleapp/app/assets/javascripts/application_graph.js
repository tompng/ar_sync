//= require rails-ujs
//= require action_cable
//= require ar_sync_graph
//= require cable
//= require components
//= require filters
//= require ar_sync_actioncable_adapter
ArSyncModel.setConnectionAdapter(new ArSyncActionCableAdapter())
