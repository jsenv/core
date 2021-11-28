/* eslint-env browser */

export const createEventSourceConnection = (
  eventSourceUrl,
  events = {},
  { retryMaxAttempt = Infinity, retryAllocatedMs = Infinity, lastEventId } = {},
) => {
  const { EventSource } = window
  if (typeof EventSource !== "function") {
    return () => {}
  }

  const eventSourceOrigin = new URL(eventSourceUrl).origin
  Object.keys(events).forEach((eventName) => {
    const eventCallback = events[eventName]
    events[eventName] = (e) => {
      if (e.origin === eventSourceOrigin) {
        if (e.lastEventId) {
          lastEventId = e.lastEventId
        }
        eventCallback(e)
      }
    }
  })

  let connectionStatus = "default"
  let connectionStatusChangeCallback = () => {}
  let _disconnect = () => {}

  const goToStatus = (newStatus) => {
    if (newStatus !== connectionStatus) {
      connectionStatus = newStatus
      connectionStatusChangeCallback()
    }
  }

  const attemptConnection = (url) => {
    const eventSource = new EventSource(url, {
      withCredentials: true,
    })
    _disconnect = () => {
      if (
        connectionStatus !== "connecting" &&
        connectionStatus !== "connected"
      ) {
        console.warn(
          `disconnect() ignored because connection is ${connectionStatus}`,
        )
        return
      }
      eventSource.onerror = undefined
      eventSource.close()
      Object.keys(events).forEach((eventName) => {
        eventSource.removeEventListener(eventName, events[eventName])
      })
      goToStatus("disconnected")
    }
    let retryCount = 0
    let firstRetryMs = Date.now()
    eventSource.onerror = (errorEvent) => {
      if (errorEvent.target.readyState === EventSource.CONNECTING) {
        if (retryCount > retryMaxAttempt) {
          console.info(`could not connect after ${retryMaxAttempt} attempt`)
          _disconnect()
          return
        }

        if (retryCount === 0) {
          firstRetryMs = Date.now()
        } else {
          const allRetryDuration = Date.now() - firstRetryMs
          if (retryAllocatedMs && allRetryDuration > retryAllocatedMs) {
            console.info(
              `could not connect in less than ${retryAllocatedMs} ms`,
            )
            _disconnect()
            return
          }
        }

        retryCount++
        goToStatus("connecting")
        return
      }

      if (errorEvent.target.readyState === EventSource.CLOSED) {
        _disconnect()
        return
      }
    }
    eventSource.onopen = () => {
      goToStatus("connected")
    }
    Object.keys(events).forEach((eventName) => {
      eventSource.addEventListener(eventName, events[eventName])
    })
    if (!events.hasOwnProperty("welcome")) {
      eventSource.addEventListener("welcome", (e) => {
        if (e.origin === eventSourceOrigin && e.lastEventId) {
          lastEventId = e.lastEventId
        }
      })
    }
    goToStatus("connecting")
  }

  let connect = () => {
    attemptConnection(eventSourceUrl)
    connect = () => {
      attemptConnection(
        lastEventId
          ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId)
          : eventSourceUrl,
      )
    }
  }

  const removePageUnloadListener = listenPageUnload(() => {
    _disconnect()
  })

  const destroy = () => {
    removePageUnloadListener()
    _disconnect()
  }

  return {
    getConnectionStatus: () => connectionStatus,
    setConnectionStatusChangeCallback: (callback) => {
      connectionStatusChangeCallback = callback
    },
    connect,
    disconnect: () => _disconnect(),
    destroy,
  }
}

const addLastEventIdIntoUrlSearchParams = (url, lastEventId) => {
  if (url.indexOf("?") === -1) {
    url += "?"
  } else {
    url += "&"
  }
  return `${url}last-event-id=${encodeURIComponent(lastEventId)}`
}

// const listenPageMightFreeze = (callback) => {
//   const removePageHideListener = listenEvent(window, "pagehide", (pageHideEvent) => {
//     if (pageHideEvent.persisted === true) {
//       callback(pageHideEvent)
//     }
//   })
//   return removePageHideListener
// }

// const listenPageFreeze = (callback) => {
//   const removeFreezeListener = listenEvent(document, "freeze", (freezeEvent) => {
//     callback(freezeEvent)
//   })
//   return removeFreezeListener
// }

// const listenPageIsRestored = (callback) => {
//   const removeResumeListener = listenEvent(document, "resume", (resumeEvent) => {
//     removePageshowListener()
//     callback(resumeEvent)
//   })
//   const removePageshowListener = listenEvent(window, "pageshow", (pageshowEvent) => {
//     if (pageshowEvent.persisted === true) {
//       removePageshowListener()
//       removeResumeListener()
//       callback(pageshowEvent)
//     }
//   })
//   return () => {
//     removeResumeListener()
//     removePageshowListener()
//   }
// }

const listenPageUnload = (callback) => {
  const removePageHideListener = listenEvent(
    window,
    "pagehide",
    (pageHideEvent) => {
      if (pageHideEvent.persisted !== true) {
        callback(pageHideEvent)
      }
    },
  )
  return removePageHideListener
}

const listenEvent = (emitter, event, callback) => {
  emitter.addEventListener(event, callback)
  return () => {
    emitter.removeEventListener(event, callback)
  }
}
