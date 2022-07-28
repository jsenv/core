import { startServer, createSSERoom } from "@jsenv/server"

const room = createSSERoom()
setInterval(() => {
  room.sendEventToAllClients({
    type: "ping",
  })
}, 1000)

startServer({
  logLevel: "warn",
  protocol: "https",
  port: 3456,
  requestToResponse: (request) => {
    const { accept = "" } = request.headers
    if (!accept.includes("text/event-stream")) {
      return null
    }
    return room.join(request)
  },
})
