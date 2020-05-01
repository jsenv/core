const FAILURE_CONSEQUENCE_RENOUNCING = "renouncing"
const FAILURE_CONSEQUENCE_DISCONNECTION = "disconnection"
const FAILURE_REASON_ERROR = "error"
const FAILURE_REASON_SCRIPT = "script"
const BACKGROUND_RECONNECTION_FLAG = "background-reconnection"
const ON_ERROR_RECONNECTION_FLAG = "on-error-reconnection"

/* eslint-disable new-cap */
export const connectEventSource = async (
  eventSourceUrl,
  events = {},
  {
    CONNECTING = () => {},
    CONNECTION_FAILURE = () => {},
    CONNECTED = () => {},
    connectionAttemptConfig = {
      maxAttempt: Infinity,
      allocatedMs: Infinity,
      intervalCompute: () => 500,
    },
    reconnectionOnError = false,
    // failure to reconnect starts a background attempt to reconnect
    // it will not notify the attempt nor failure only if it succeeds
    // any successful connection requested during the background reconnection cancels it
    // if failed nothing else will be tried
    backgroundReconnection = false,
    reconnectionAttemptConfig = connectionAttemptConfig,
    reconnectionOnErrorAttemptConfig = connectionAttemptConfig,
    backgroundReconnectionAttemptConfig = connectionAttemptConfig,
  } = {},
) => {
  const { EventSource } = window
  if (typeof EventSource !== "function") {
    return () => {}
  }

  const eventSourceOrigin = new URL(eventSourceUrl).origin
  let backgroundReconnectionAttempt

  const notifyConnecting = ({ reconnectionFlag, ...rest }) => {
    if (backgroundReconnectionAttempt && reconnectionFlag !== BACKGROUND_RECONNECTION_FLAG) {
      backgroundReconnectionAttempt.abort()
      backgroundReconnectionAttempt = undefined
    }
    CONNECTING({ reconnectionFlag, ...rest })
  }
  const notifyConnected = ({ reconnectionFlag, ...rest }) => {
    if (backgroundReconnectionAttempt) {
      if (reconnectionFlag !== BACKGROUND_RECONNECTION_FLAG) {
        backgroundReconnectionAttempt.abort()
      }
      backgroundReconnectionAttempt = undefined
    }
    CONNECTED({ reconnectionFlag, ...rest })
  }
  const notifyFailure = ({ failureConsequence, failureReason, reconnectionFlag, ...rest }) => {
    if (reconnectionFlag === BACKGROUND_RECONNECTION_FLAG) {
      backgroundReconnectionAttempt = undefined
      return
    }

    if (backgroundReconnectionAttempt && reconnectionFlag !== BACKGROUND_RECONNECTION_FLAG) {
      backgroundReconnectionAttempt.abort()
      backgroundReconnectionAttempt = undefined
    }

    // important: keep this callback before reconnect
    // otherwise user would be notified from connecting-> failure
    // instead of failure -> connecting
    CONNECTION_FAILURE({
      failureConsequence,
      failureReason,
      reconnectionFlag,
      ...rest,
    })

    // an error disconnected the event source, try to reconnect automatically
    if (
      reconnectionOnError &&
      failureConsequence === FAILURE_CONSEQUENCE_DISCONNECTION &&
      failureReason === FAILURE_REASON_ERROR
    ) {
      const reconnectionOnErrorAttempt = connect({
        reconnectionFlag: ON_ERROR_RECONNECTION_FLAG,
        ...reconnectionOnErrorAttemptConfig,
      })
      // retry to connect immediatly
      reconnectionOnErrorAttempt.start()
      return // prevent background reconnection in this case
    }

    // starts the background reconnection when reconnection fail
    // except if user abort it (reason !== SCRIPT)
    if (
      backgroundReconnection &&
      reconnectionFlag &&
      reconnectionFlag !== BACKGROUND_RECONNECTION_FLAG &&
      failureReason !== FAILURE_REASON_SCRIPT
    ) {
      backgroundReconnectionAttempt = connect({
        reconnectionFlag: BACKGROUND_RECONNECTION_FLAG,
        ...backgroundReconnectionAttemptConfig,
      })
      backgroundReconnectionAttempt.startAsap({ notify: false })
    }
  }

  let cancel = () => {}

  const attemptConnection = async ({ onsuccess, onfailure }) => {
    const eventSource = new EventSource(eventSourceUrl, {
      withCredentials: true,
    })

    let connected = false
    eventSource.onopen = () => {
      connected = true

      cancel = () => {
        eventSource.onerror = undefined
        eventSource.close()
      }

      eventSource.onerror = () => {
        eventSource.onerror = undefined
        cancel = () => {}
        connected = false
        eventSource.close()
        onfailure({
          failureConsequence: FAILURE_CONSEQUENCE_DISCONNECTION,
          failureReason: FAILURE_REASON_ERROR,
        })
      }

      onsuccess({
        disconnect: () => {
          if (!connected) {
            throw new Error(`already disconnected`)
          }
          connected = false
          eventSource.close()
          onfailure({
            failureConsequence: FAILURE_CONSEQUENCE_DISCONNECTION,
            failureReason: FAILURE_REASON_SCRIPT,
          })
        },
      })
    }
    eventSource.onerror = () => {
      eventSource.close()
      onfailure({
        failureConsequence: FAILURE_CONSEQUENCE_RENOUNCING,
        failureReason: FAILURE_REASON_ERROR,
      })
    }
    cancel = () => {
      eventSource.onopen = undefined
      eventSource.onerror = undefined
      eventSource.close()
    }
    Object.keys(events).forEach((eventName) => {
      eventSource.addEventListener(eventName, (e) => {
        if (e.origin === eventSourceOrigin) {
          events[eventName](e)
        }
      })
    })

    return () => {
      if (connected) {
        throw new Error(`cannot abort opened connection`)
      }
      eventSource.close()
      onfailure({
        failureConsequence: FAILURE_CONSEQUENCE_RENOUNCING,
        failureReason: FAILURE_REASON_SCRIPT,
      })
    }
  }

  const connect = ({
    reconnectionFlag,
    maxAttempt = Infinity,
    allocatedMs = Infinity,
    intervalCompute = () => 500,
  }) => {
    const startTime = Date.now()
    let attemptCount = 0
    let attemptTimeout
    let abortAttempt

    const attempt = () => {
      attemptCount++
      abortAttempt = attemptConnection({
        onsuccess: ({ disconnect }) => {
          notifyConnected({ reconnectionFlag, disconnect })
        },
        onfailure: ({ failureConsequence, failureReason }) => {
          const reconnect = ({ reconnectionFlag = true, ...rest } = {}) => {
            const connectionAttempt = connect({
              reconnectionFlag,
              ...reconnectionAttemptConfig,
              ...rest,
            })
            connectionAttempt.start()
          }

          // console.log("failure", { failureConsequence, failureReason, maxAttempt, allocatedMs })

          if (failureConsequence === FAILURE_CONSEQUENCE_DISCONNECTION) {
            notifyFailure({
              failureConsequence,
              failureReason,
              reconnect,
            })
            return
          }

          const attemptDuration = Date.now() - startTime
          const meta = {
            reconnectionFlag,
            // tell outside how many time we tried
            attemptCount,
            // tell outside for how long we tried
            attemptDuration,
            // give a way to retry
            reconnect,
          }

          if (failureReason === FAILURE_REASON_SCRIPT) {
            // someone aborted the reconnection
            notifyFailure({
              failureConsequence,
              failureReason,
              ...meta,
            })
            return
          }

          if (attemptCount >= maxAttempt) {
            notifyFailure({
              failureConsequence: FAILURE_CONSEQUENCE_RENOUNCING,
              failureReason: `could not connect after ${maxAttempt} attempt`,
              ...meta,
            })
            return
          }

          const retryIn = (ms) => {
            attemptTimeout = delay(attempt, ms)
            cancel = () => {
              clearTimeout(attemptTimeout)
            }
          }

          const interval = intervalCompute(attemptCount)

          if (allocatedMs && allocatedMs !== Infinity) {
            const remainingMs = allocatedMs - attemptDuration
            if (remainingMs <= 0) {
              notifyFailure({
                failureConsequence: FAILURE_CONSEQUENCE_RENOUNCING,
                failureReason: `could not connect in less than ${allocatedMs} ms`,
                ...meta,
              })
              return
            }
            retryIn(Math.min(remainingMs, interval))
          } else {
            retryIn(interval)
          }
        },
      })
    }

    const abort = () => {
      abortAttempt()
      clearTimeout(attemptTimeout)
    }

    const startAsap = ({ notify }) => {
      const interval = intervalCompute(attemptCount)
      attemptTimeout = delay(() => {
        start({ notify })
      }, interval)
      cancel = () => {
        clearTimeout(attemptTimeout)
      }
    }

    const start = ({ notify = true } = {}) => {
      attempt()
      if (notify) {
        notifyConnecting({
          reconnectionFlag,
          abort,
        })
      }
    }

    return { start, startAsap, abort }
  }

  const connectionAttempt = connect(connectionAttemptConfig)
  connectionAttempt.start()

  return cancel
}

const delay = (fn, ms) => {
  if (ms === 0) {
    fn()
    return undefined
  }
  return setTimeout(fn, ms)
}
