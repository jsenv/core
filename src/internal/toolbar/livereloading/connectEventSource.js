export const connectEventSource = (
  eventSourceUrl,
  events = {},
  {
    connecting = () => {},
    connected = () => {},
    cancelled = () => {},
    failed = () => {},
    retryMaxAttempt = Infinity,
    retryAllocatedMs = Infinity,
  } = {},
) => {
  const { EventSource } = window
  if (typeof EventSource !== "function") {
    return () => {}
  }

  const eventSourceOrigin = new URL(eventSourceUrl).origin

  // will be either abort, disconnect or a third function calling cancelled
  // depending on connectionStatus
  let cancelCurrentConnection = () => {}

  const attemptConnection = () => {
    const eventSource = new EventSource(eventSourceUrl, {
      withCredentials: true,
    })

    let connectionStatus = "connecting"
    const abort = () => {
      if (connectionStatus !== "connecting") {
        console.warn(`abort ignored because connection is ${connectionStatus}`)
        return
      }
      connectionStatus = "aborted"
      eventSource.onerror = undefined
      eventSource.close()
      cancelled({ connect: attemptConnection })
    }
    cancelCurrentConnection = abort
    connecting({ cancel: abort })

    eventSource.onopen = () => {
      connectionStatus = "connected"
      const disconnect = () => {
        if (connectionStatus !== "connected") {
          console.warn(`disconnect ignored because connection is ${connectionStatus}`)
          return
        }
        connectionStatus = "disconnected"
        eventSource.onerror = undefined
        eventSource.close()
        cancelled({ connect: attemptConnection })
      }
      cancelCurrentConnection = disconnect
      connected({ cancel: disconnect })
    }

    let retryCount = 0
    let firstRetryMs = Date.now()

    eventSource.onerror = (errorEvent) => {
      const considerFailed = () => {
        connectionStatus = "disconnected"
        failed({
          cancel: () => {
            if (connectionStatus !== "failed") {
              console.warn(`disable ignored because connection is ${connectionStatus}`)
              return
            }
            connectionStatus = "disabled"
            cancelled({ connect: attemptConnection })
          },
          connect: attemptConnection,
        })
      }

      if (errorEvent.target.readyState === EventSource.CONNECTING) {
        if (retryCount > retryMaxAttempt) {
          console.info(`could not connect after ${retryMaxAttempt} attempt`)
          eventSource.onerror = undefined
          eventSource.close()
          considerFailed()
          return
        }

        if (retryCount === 0) {
          firstRetryMs = Date.now()
        } else {
          const allRetryDuration = Date.now() - firstRetryMs
          if (retryAllocatedMs && allRetryDuration > retryAllocatedMs) {
            console.info(`could not connect in less than ${retryAllocatedMs} ms`)
            eventSource.onerror = undefined
            eventSource.close()
            considerFailed()
            return
          }
        }

        connectionStatus = "connecting"
        retryCount++
        connecting({ cancel: abort })
        return
      }

      if (errorEvent.target.readyState === EventSource.CLOSED) {
        considerFailed()
        return
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

  attemptConnection()
  const disconnect = () => {
    cancelCurrentConnection()
  }

  window.addEventListener(`beforeunload`, disconnect)
  return () => {
    window.removeEventListener(`beforeunload`, disconnect)
    disconnect()
  }
}
