import { processTeardown } from "../../../server/index.js"

export const open = (url, callback) => {
  const eventSource = new global.EventSource(url, {
    https: { rejectUnauthorized: false },
  })

  const close = () => {
    eventSource.close()
  }

  // by listening processTeardown we indirectly
  // do something like process.on('SIGINT', () => process.exit())
  processTeardown(close)

  eventSource.addEventListener("file-changed", (e) => {
    if (e.origin !== url) {
      return
    }
    const fileChanged = e.data
    callback(fileChanged)
  })

  return close
}
