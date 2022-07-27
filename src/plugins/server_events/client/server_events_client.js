import { createWebSocketConnection } from "./web_socket_connection.js"

const websocketConnection = createWebSocketConnection(document.location.href, {
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
