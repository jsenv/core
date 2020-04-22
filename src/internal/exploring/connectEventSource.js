const FAILURE_CONSEQUENCE_RENOUNCING = "renouncing"
const FAILURE_CONSEQUENCE_DISCONNECTION = "disconnection"
const FAILURE_REASON_ERROR = "error"
const FAILURE_REASON_SCRIPT = "script"

/* eslint-disable new-cap */
export const connectEventSource = async (
  eventSourceUrl,
  events = {},
  {
    CONNECTING = () => {},
    CONNECTION_FAILURE = () => {},
    CONNECTED = () => {},
    reconnectionOnError = false,
    reconnectionAllocatedAttempt = Infinity,
    reconnectionAllocatedMs = Infinity,
    reconnectionInterval = 1000,
    backgroundReconnection = false,
    backgroundReconnectionAllocatedAttempt = Infinity,
    backgroundReconnectionAllocatedMs = Infinity,
    backgroundReconnectionInterval = 1000,
  } = {},
) => {
  const { EventSource } = window
  if (typeof EventSource !== "function") {
    return
  }

  const eventSourceOrigin = new URL(eventSourceUrl).origin

  const notifyConnecting = (params) => {
    CONNECTING(params)
  }
  const notifyConnected = (params) => {
    CONNECTED(params)
  }
  const notifyFailure = ({
    failureConsequence,
    failureReason,
    reconnect,
    reconnectionFlag,
    ...rest
  }) => {
    if (reconnectionOnError && !reconnectionFlag && failureReason === FAILURE_REASON_ERROR) {
      reconnect({
        reconnectionFlag: "auto-reconnection",
        reconnectionAllocatedAttempt,
        reconnectionAllocatedMs,
        reconnectionInterval,
      })
    }
    if (backgroundReconnection) {
      reconnect({
        reconnectionAllocatedAttempt: backgroundReconnectionAllocatedAttempt,
        reconnectionAllocatedMs: backgroundReconnectionAllocatedMs,
        reconnectionInterval: backgroundReconnectionInterval,
      })
    }
    CONNECTION_FAILURE({
      failureConsequence,
      failureReason,
      reconnect,
      reconnectionFlag,
      ...rest,
    })
  }

  const connect = async ({ onsuccess, onfailure }) => {
    const eventSource = new EventSource(eventSourceUrl, {
      withCredentials: true,
    })

    let connected = false
    eventSource.onopen = () => {
      connected = true

      eventSource.onerror = () => {
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

  const abortConnection = connect({
    onsuccess: ({ disconnect }) => {
      notifyConnected({ disconnect })
    },
    onfailure: ({ failureConsequence, failureReason }) => {
      const reconnect = ({
        reconnectionFlag = true,
        allocatedAttempt = reconnectionAllocatedAttempt,
        allocatedMs = reconnectionAllocatedMs,
        interval = reconnectionInterval,
      } = {}) => {
        const startTime = Date.now()
        let attemptCount = 1
        let attemptTimeout
        let abortReconnection

        const attempt = () => {
          abortReconnection = connect({
            onsuccess: ({ disconnect }) => {
              notifyConnected({ reconnectionFlag, disconnect })
            },
            onfailure: ({ failureConsequence, failureReason }) => {
              // the reconnection was a success but we got disconnected for some reason
              if (failureConsequence === FAILURE_CONSEQUENCE_DISCONNECTION) {
                notifyFailure({
                  failureConsequence,
                  failureReason,
                  reconnect,
                })
                return
              }

              const consumedMs = Date.now() - startTime
              const meta = {
                reconnectionFlag,
                // tell outside how many time we tried
                reconnectionAttemptCount: attemptCount,
                // tell outside for how long we tried
                reconnectAttemptDuration: consumedMs,
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

              if (attemptCount >= allocatedAttempt) {
                notifyFailure({
                  failureConsequence: FAILURE_CONSEQUENCE_RENOUNCING,
                  failureReason: `could not connect after ${allocatedAttempt} attempt`,
                  ...meta,
                })
                return
              }

              const retryIn = (ms) => {
                attemptTimeout = setTimeout(() => {
                  attemptCount++
                  attempt()
                }, ms)
              }

              if (allocatedMs !== Infinity && typeof allocatedMs === "number") {
                const remainingMs = allocatedMs - consumedMs
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

        attempt()
        notifyConnecting({
          reconnectionFlag,
          abort: () => {
            abortReconnection()
            clearTimeout(attemptTimeout)
          },
        })
      }

      notifyFailure({
        failureConsequence,
        failureReason,
        reconnect,
      })
    },
  })

  notifyConnecting({
    abort: abortConnection,
  })
}
