const RECONNECT_ATTEMPT_MIN_DELAY = 100
const RECONNECT_ATTEMPT_MAX_DELAY = 2000

export const connectEventSource = async (
  eventSourceUrl,
  events = {},
  { onConnect = () => {}, onDisconnect = () => {} } = {},
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

  const connect = async () => {
    const eventSource = new EventSource(eventSourceUrl, {
      withCredentials: true,
    })

    close = () => {
      eventSource.close()
      if (connected) {
        connected = false
        onDisconnect()
      }
    }

    eventSource.onopen = () => {
      connected = true
      onConnect({ isReconnection: reconnecting })
      reconnecting = false
    }
    Object.keys(events).forEach((eventName) => {
      eventSource.addEventListener(eventName, (e) => {
        if (e.origin === eventSourceOrigin) {
          events[eventName](e)
        }
      })
    })
    eventSource.onerror = () => {
      close()

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
  }
  connect()

  return () => {
    clearTimeout(timeoutId)
    close()
  }
}
