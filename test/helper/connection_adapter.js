class ConnectionAdapter {
  constructor() {
    this.rooms = {}
  }
  subscribe(key, callback) {
    let room = this.rooms[key]
    if (!room) room = this.rooms[key] = { id: 0, callbacks: {}, counts: 0 }
    const subKey = room.id++
    room.callbacks[subKey] = callback
    room.count++
    return () => {
      delete room.callbacks[subKey]
      room.count--
      if (room.count === 0) delete this.rooms[key]
    }
  }
  notify(key, data) {
    const room = this.rooms[key]
    if (!room) return
    for (const cb of room.callbacks) cb(data)
  }
}

module.exports = ConnectionAdapter
