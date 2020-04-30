import { connectEventSource } from "./connectEventSource.js"
import { jsenvLogger } from "./jsenvLogger.js"
import { createPreference } from "./preferences.js"

const livereloadingPreference = createPreference("livereloading")

export const createLivereloading = (
  fileRelativeUrl,
  { onFileChanged, onFileRemoved, onConnecting, onAborted, onConnectionFailed, onConnected },
) => {
  const eventSourceUrl = `${window.origin}/${fileRelativeUrl}`

  let cancel = () => {}

  const connect = () => {
    livereloadingPreference.set(true)
    return new Promise((resolve) => {
      cancel = connectEventSource(
        eventSourceUrl,
        {
          "file-changed": ({ data }) => {
            jsenvLogger.debug(`${data} changed`)
            onFileChanged(data)
          },
          "file-removed": ({ data }) => {
            jsenvLogger.debug(`${data} removed`)
            onFileRemoved(data)
          },
        },
        {
          CONNECTING: ({ abort }) => {
            jsenvLogger.debug(`connecting to ${eventSourceUrl}`)
            onConnecting({
              abort: () => {
                livereloadingPreference.set(false)
                abort()
              },
            })
          },
          CONNECTION_FAILURE: ({
            failureConsequence,
            failureReason,
            reconnectionFlag,
            reconnect,
          }) => {
            resolve(false)
            if (failureConsequence === "renouncing" && reconnectionFlag) {
              jsenvLogger.debug(`failed connection to ${eventSourceUrl}`)
            }
            if (failureConsequence === "renouncing" && !reconnectionFlag) {
              jsenvLogger.debug(`aborted connection to ${eventSourceUrl}`)
            }
            if (failureConsequence === "disconnection") {
              jsenvLogger.debug(`disconnected from ${eventSourceUrl}`)
            }

            if (failureReason === "script") {
              onAborted({ connect })
            } else {
              onConnectionFailed({ reconnect })
            }
          },
          CONNECTED: ({ disconnect }) => {
            resolve(true)
            jsenvLogger.debug(`connected to ${eventSourceUrl}`)
            onConnected({
              disconnect: () => {
                livereloadingPreference.set(false)
                disconnect()
              },
            })
          },
          reconnectionOnError: false,
          reconnectionAllocatedMs: 1000 * 1, // 30 seconds
          reconnectionIntervalCompute: () => 1000, // 1 second
          backgroundReconnection: false,
          backgroundReconnectionAllocatedMs: 1000 * 60 * 60 * 24, // 24 hours
          backgroundReconnectionIntervalCompute: (attemptCount) => {
            return Math.min(
              Math.pow(2, attemptCount) * 1000, // 1s, 2s, 4s, 8s, 16s, ...
              1000 * 60 * 10, // 10 minutes
            )
          },
        },
      )
    })
  }

  const isEnabled = () => {
    return livereloadingPreference.has() ? livereloadingPreference.get() : true
  }

  return {
    isEnabled,
    connect,
    disconnect: () => cancel(),
  }
}
