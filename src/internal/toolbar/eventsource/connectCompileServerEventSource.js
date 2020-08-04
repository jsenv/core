import { connectEventSource } from "./connectEventSource.js"
import { jsenvLogger } from "../util/jsenvLogger.js"

export const connectCompileServerEventSource = (
  fileRelativeUrl,
  {
    onFileModified,
    onFileRemoved,
    onConnecting,
    onConnectionCancelled,
    onConnectionFailed,
    onConnected,
    lastEventId,
  },
) => {
  const eventSourceUrl = `${window.origin}/${fileRelativeUrl}`

  let cancel = () => {}

  const connect = () => {
    return new Promise((resolve) => {
      cancel = connectEventSource(
        eventSourceUrl,
        {
          "file-modified": ({ data }) => {
            jsenvLogger.debug(`${data} modified`)
            onFileModified(data)
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
                cancel()
              },
            })
          },
          connected: ({ cancel }) => {
            jsenvLogger.debug(`connected to ${eventSourceUrl}`)
            resolve(true)
            onConnected({
              cancel: () => {
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
          lastEventId,
        },
      )
    })
  }

  return {
    connect,
    disconnect: () => cancel(),
  }
}
