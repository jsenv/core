const RECONNECT_ATTEMPT_MIN_DELAY = 100
const RECONNECT_ATTEMPT_MAX_DELAY = 2000

export const connectFileChangesEventSource = (
  eventSourceUrl,
  { onConnect = () => {}, onFileChange = () => {}, onDisconnect = () => {} } = {},
) => {
  const { EventSource } = window

  if (typeof EventSource !== "function") {
    return () => {}
  }

  const eventSourceOrigin = new URL(eventSourceUrl).origin

  let connected = false
  let reconnecting = false
  let reconnectAttempt = 0
  let timeoutId
  let close = () => {}

  const connect = () => {
    const eventSource = new EventSource(eventSourceUrl, {
      withCredentials: true,
    })

    close = () => {
      eventSource.close()
      if (connected) {
        connected = false
        onDisconnect()
      }

      if (reconnecting) {
        timeoutId = setTimeout(
          connect,
          Math.min(RECONNECT_ATTEMPT_MIN_DELAY * reconnectAttempt, RECONNECT_ATTEMPT_MAX_DELAY),
        )
        reconnectAttempt++
      } else {
        reconnecting = true
        reconnectAttempt = 1
        connect()
      }
    }

    eventSource.onopen = () => {
      connected = true
      onConnect({ isReconnection: reconnecting })
      reconnecting = false
    }
    eventSource.onerror = () => {
      // we could try to reconnect several times before giving up
      // but dont keep it open as it would try to reconnect forever
      // maybe, it depends what error occurs, or we could
      // retry less frequently
      close()
    }
    eventSource.addEventListener("file-changed", (e) => {
      if (e.origin !== eventSourceOrigin) {
        return
      }
      const fileChanged = e.data
      onFileChange(fileChanged)
    })
  }
  connect()

  return () => {
    clearTimeout(timeoutId)
    close()
  }
}
