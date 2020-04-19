const RECONNECT_ATTEMPT_MIN_DELAY = 100
const RECONNECT_ATTEMPT_MAX_DELAY = 3000
const GIVE_UP_AFTER_ATTEMPT = 10

export const connectEventSource = async (
  eventSourceUrl,
  events = {},
  connectionChangeCallback = () => {},
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
    connectionChangeCallback(reconnecting ? "reconnecting" : "connecting")

    const eventSource = new EventSource(eventSourceUrl, {
      withCredentials: true,
    })

    close = () => {
      eventSource.close()
      if (connected) {
        connected = false
        connectionChangeCallback("disconnected")
      }
    }

    eventSource.onopen = () => {
      connected = true
      connectionChangeCallback(reconnecting ? "reconnected" : "connected")
      reconnecting = false
    }
    eventSource.onerror = () => {
      close()

      if (reconnecting) {
        if (reconnectAttempt === GIVE_UP_AFTER_ATTEMPT) {
          connectionChangeCallback("failed")
          return
        }
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
    Object.keys(events).forEach((eventName) => {
      eventSource.addEventListener(eventName, (e) => {
        if (e.origin === eventSourceOrigin) {
          events[eventName](e)
        }
      })
    })
  }
  connect()

  return () => {
    clearTimeout(timeoutId)
    close()
  }
}
