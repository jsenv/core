import EventSource from "eventsource"

export const open = (url, callback) => {
  const eventSource = new EventSource(url, {
    https: { rejectUnauthorized: false },
  })

  const close = () => {
    eventSource.close()
  }

  eventSource.addEventListener("file-changed", (e) => {
    if (e.origin !== url) {
      return
    }
    const fileChanged = e.data
    callback(fileChanged)
  })

  return close
}
