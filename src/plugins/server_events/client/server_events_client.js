/* globals self */

import { createWebSocketConnection } from "./web_socket_connection.js"

const websocketScheme = self.location.protocol === "https" ? "wss" : "ws"
const websocketUrl = `${websocketScheme}://${self.location.host}`
const websocketConnection = createWebSocketConnection(websocketUrl, {
  retry: true,
  retryMaxAttempt: Infinity,
  retryAllocatedMs: 20_000,
})
const { readyState, connect, disconnect, listenEvents } = websocketConnection
window.__server_events__ = {
  readyState,
  connect,
  disconnect,
  listenEvents,
}
connect()
