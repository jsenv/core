import { connectEventSource } from "./connectEventSource.js"
import { jsenvLogger } from "./jsenvLogger.js"
import { livereloadingPreference } from "./preferences.js"

export const connectLivereloading = (
  fileRelativeUrl,
  { onFileChanged, onFileRemoved, onConnecting, onAborted, onConnectionFailed, onConnected },
) => {
  const livereloadingEnabled = livereloadingPreference.has() ? livereloadingPreference.get() : true
  const eventSourceUrl = `${window.origin}/${fileRelativeUrl}`

  const connect = () => {
    livereloadingPreference.set(true)
    connectEventSource(
      eventSourceUrl,
      {
        "file-changed": ({ data }) => {
          jsenvLogger.log(`${data} changed`)
          onFileChanged(data)
        },
        "file-removed": ({ data }) => {
          jsenvLogger.log(`${data} removed`)
          onFileRemoved(data)
        },
      },
      {
        CONNECTING: ({ abort }) => {
          jsenvLogger.log(`connecting to ${eventSourceUrl}`)
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
          if (failureConsequence === "renouncing" && reconnectionFlag) {
            jsenvLogger.log(`failed connection to ${eventSourceUrl}`)
          }
          if (failureConsequence === "renouncing" && !reconnectionFlag) {
            jsenvLogger.log(`aborted connection to ${eventSourceUrl}`)
          }
          if (failureConsequence === "disconnection") {
            jsenvLogger.log(`disconnected from ${eventSourceUrl}`)
          }

          if (failureReason === "script") {
            onAborted({ connect })
          } else {
            onConnectionFailed({ reconnect })
          }
        },
        CONNECTED: ({ disconnect }) => {
          jsenvLogger.log(`connected to ${eventSourceUrl}`)
          onConnected({
            disconnect: () => {
              livereloadingPreference.set(false)
              disconnect()
            },
          })
        },
        reconnectionOnError: true,
        reconnectionAllocatedMs: 1000 * 1, // 30 seconds
        reconnectionIntervalCompute: () => 1000, // 1 second
        backgroundReconnection: true,
        backgroundReconnectionAllocatedMs: 1000 * 60 * 60 * 24, // 24 hours
        backgroundReconnectionIntervalCompute: (attemptCount) => {
          return Math.min(
            Math.pow(2, attemptCount) * 1000, // 1s, 2s, 4s, 8s, 16s, ...
            1000 * 60 * 10, // 10 minutes
          )
        },
      },
    )
  }

  if (livereloadingEnabled) {
    connect()
    return true
  }
  onAborted({ connect })
  return false
}
