import { connectEventSource } from "./connectEventSource.js"
import { jsenvLogger } from "../util/jsenvLogger.js"
import { createPreference } from "../util/preferences.js"

const livereloadingPreference = createPreference("livereloading")

export const getLivereloadingPreference = () => {
  return livereloadingPreference.has() ? livereloadingPreference.get() : true
}

export const createLivereloading = (
  fileRelativeUrl,
  {
    onFileChanged,
    onFileRemoved,
    onConnecting,
    onConnectionCancelled,
    onConnectionFailed,
    onConnected,
  },
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
          connecting: ({ cancel }) => {
            jsenvLogger.debug(`connecting to ${eventSourceUrl}`)
            onConnecting({
              cancel: () => {
                livereloadingPreference.set(false)
                cancel()
              },
            })
          },
          connected: ({ cancel }) => {
            jsenvLogger.debug(`connected to ${eventSourceUrl}`)
            resolve(true)
            onConnected({
              cancel: () => {
                livereloadingPreference.set(false)
                cancel()
              },
            })
          },
          cancelled: ({ connect }) => {
            jsenvLogger.debug(`disconnected from ${eventSourceUrl}`)
            resolve(false)
            onConnectionCancelled({ connect })
          },
          failed: ({ connect }) => {
            jsenvLogger.debug(`disconnected from ${eventSourceUrl}`)
            resolve(false)
            onConnectionFailed({ connect })
          },
          retryMaxAttempt: Infinity,
          retryAllocatedMs: 20 * 1000,
        },
      )
    })
  }

  return {
    connect,
    disconnect: () => cancel(),
  }
}
