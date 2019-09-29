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
    const unsubscribe = () => {
      delete room.callbacks[subKey]
      room.count--
      if (room.count === 0) delete this.rooms[key]
    }
    return { unsubscribe }
  }
  notify(key, data) {
    const room = this.rooms[key]
    if (!room) return
    for (const cb of Object.values(room.callbacks)) cb(data)
  }
}

module.exports = ConnectionAdapter
