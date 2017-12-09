App.sync = App.cable.subscriptions.create({
    channel: "SyncChannel",
    key: 'aaa',
  },
  {
    connected: function() {
      console.error('connected')
    },

    disconnected: function() {
      console.error('disconnected')
    },

    received: function(data) {
      console.error('receive', data)
    }
  }
)
