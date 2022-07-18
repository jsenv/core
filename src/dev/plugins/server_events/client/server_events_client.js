import { createEventSourceConnection } from "./event_source_connection.js"

const eventsourceConnection = createEventSourceConnection(
  document.location.href,
  {
    retryMaxAttempt: Infinity,
    retryAllocatedMs: 20 * 1000,
  },
)
const { status, connect, addEventCallbacks, disconnect } = eventsourceConnection
window.__server_events__ = {
  addEventCallbacks,
  status,
  connect,
  disconnect,
}
