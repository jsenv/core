import { connectEventSource } from "./connectEventSource.js"
import { jsenvLogger } from "../../exploring/util/jsenvLogger.js"
import { createPreference } from "../../exploring/util/preferences.js"

const livereloadingPreference = createPreference("livereloading")

export const getLivereloadingPreference = () => {
  return livereloadingPreference.has() ? livereloadingPreference.get() : true
}

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
          connectionAttemptConfig: {
            allocatedMs: 1000 * 30, // 30 seconds
            intervalCompute: () => 1000, // 1 second
          },
          backgroundReconnectionAttemptConfig: {
            allocatedMs: 1000 * 60 * 60 * 24, // 24 hours
            intervalCompute: (attemptCount) => {
              return Math.min(
                Math.pow(2, attemptCount) * 1000, // 1s, 2s, 4s, 8s, 16s, ...
                1000 * 60 * 10, // 10 minutes
              )
            },
          },
          reconnectionOnError: true,
          // this is cool but quite complex and might feel unexpected
          // will certainly remove this
          backgroundReconnection: false,
        },
      )
    })
  }

  return {
    connect,
    disconnect: () => cancel(),
  }
}
