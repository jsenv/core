export const open = (url, callback) => {
  if (typeof global.EventSource !== "function") {
    console.warn(`cannot connect to sse at ${url}: global.EventSource is not a function`)
    return () => {}
  }

  const eventSource = new global.EventSource(url, {
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
