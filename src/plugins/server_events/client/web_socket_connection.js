import { createConnectionManager } from "./connection_manager.js"
import { createEventsManager } from "./events_manager.js"

export const createWebSocketConnection = (
  websocketUrl,
  {
    protocols = ["jsenv"],
    useEventsToManageConnection = true,
    retry = false,
    retryMaxAttempt = Infinity,
    retryAllocatedMs = Infinity,
  } = {},
) => {
  const connectionManager = createConnectionManager(
    ({ onClosed, onOpen }) => {
      let socket = new WebSocket(websocketUrl, protocols)
      let interval
      socket.onerror = () => {
        socket.onerror = null
        socket.onopen = null
        socket.onmessage = null
        socket = null
        onClosed()
      }
      socket.onopen = () => {
        socket.onopen = null
        onOpen()
        interval = setInterval(() => {
          socket.send('{"type":"ping"}')
        }, 30_000)
      }
      socket.onmessage = (messageEvent) => {
        const event = JSON.parse(messageEvent.data)
        eventsManager.triggerCallbacks(event)
      }
      return () => {
        if (socket) {
          socket.close()
          clearInterval(interval)
        }
      }
    },
    { retry, retryMaxAttempt, retryAllocatedMs },
  )
  const eventsManager = createEventsManager({
    effect: () => {
      if (useEventsToManageConnection) {
        connectionManager.connect()
        return () => {
          connectionManager.disconnect()
        }
      }
      return null
    },
  })

  return {
    readyState: connectionManager.readyState,
    connect: connectionManager.connect,
    disconnect: connectionManager.disconnect,
    listenEvents: (namedCallbacks) => {
      return eventsManager.addCallbacks(namedCallbacks)
    },
    destroy: () => {
      connectionManager.destroy()
      eventsManager.destroy()
    },
  }
}
