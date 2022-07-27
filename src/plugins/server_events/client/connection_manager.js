const READY_STATES = {
  CONNECTING: "connecting",
  OPEN: "open",
  CLOSING: "closing",
  CLOSED: "closed",
}

export const createConnectionManager = (
  attemptConnection,
  { retry, retryMaxAttempt, retryAllocatedMs },
) => {
  const readyState = {
    value: READY_STATES.CLOSED,
    goTo: (value) => {
      if (value === readyState.value) {
        return
      }
      readyState.value = value
      readyState.onchange()
    },
    onchange: () => {},
  }

  let _disconnect = () => {}
  const connect = () => {
    if (
      readyState.value === READY_STATES.CONNECTING ||
      readyState.value === READY_STATES.OPEN
    ) {
      return
    }
    readyState.goTo(READY_STATES.CONNECTING)

    let retryCount = 0
    let firstRetryMs = Date.now()
    const attempt = () => {
      _disconnect = attemptConnection({
        onClosed: () => {
          // onClosed can be called while connecting
          // const isClosedWhileConnecting = readyState.value === READY_STATES.CONNECTING
          // or after connection is opened
          // in both cases we'll attempt to reconnect

          if (!retry) {
            readyState.goTo(READY_STATES.CLOSED)
            return
          }
          if (retryCount > retryMaxAttempt) {
            console.info(`could not connect after ${retryMaxAttempt} attempt`)
            readyState.goTo(READY_STATES.CLOSED)
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
              readyState.goTo(READY_STATES.CLOSED)
              return
            }
          }
          retryCount++
          attempt()
        },
        onOpen: () => {
          readyState.goTo(READY_STATES.OPEN)
        },
      })
    }
    attempt()
  }

  const disconnect = () => {
    if (
      readyState.value !== READY_STATES.CONNECTING &&
      readyState.value !== READY_STATES.OPEN
    ) {
      console.warn(
        `disconnect() ignored because connection is ${readyState.value}`,
      )
      return null
    }
    return _disconnect()
  }

  const removePageUnloadListener = listenPageUnload(() => {
    if (
      readyState.value === READY_STATES.CONNECTING ||
      readyState.value === READY_STATES.OPEN
    ) {
      _disconnect()
    }
  })

  return {
    readyState,
    connect,
    disconnect,
    destroy: () => {
      removePageUnloadListener()
      disconnect()
    },
  }
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
