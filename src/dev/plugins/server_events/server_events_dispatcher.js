import { createSSERoom } from "@jsenv/server"
import { createCallbackListNotifiedOnce } from "@jsenv/abort"

export const createServerEventsDispatcher = () => {
  const destroyCallbackList = createCallbackListNotifiedOnce()
  const rooms = []
  const sseRoomLimit = 100

  return {
    addRoom: (request) => {
      const existingRoom = rooms.find(
        (roomCandidate) =>
          roomCandidate.request.ressource === request.ressource,
      )
      if (existingRoom) {
        return existingRoom
      }
      const room = createSSERoom({
        retryDuration: 2000,
        historyLength: 100,
        welcomeEventEnabled: true,
      })
      room.request = request
      destroyCallbackList.add(room.close)
      rooms.push(room)
      if (rooms.length >= sseRoomLimit) {
        const firstRoom = rooms.shift()
        firstRoom.close()
      }
      return room
    },
    dispatch: ({ type, data }) => {
      rooms.forEach((room) =>
        room.sendEventToAllClients({
          type,
          data: JSON.stringify(data),
        }),
      )
    },
    dispatchToRoomsMatching: ({ type, data }, predicate) => {
      rooms.forEach((room) => {
        if (predicate(room)) {
          room.sendEventToAllClients({
            type,
            data: JSON.stringify(data),
          })
        }
      })
    },
    destroy: () => {
      destroyCallbackList.notify()
    },
  }
}
