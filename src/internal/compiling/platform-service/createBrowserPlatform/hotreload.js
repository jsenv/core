export const open = (url, callback) => {
  if (typeof window.EventSource !== "function") {
    return () => {}
  }

  const eventSource = new window.EventSource(url, { withCredentials: true })

  const close = () => {
    eventSource.close()
  }

  eventSource.onerror = () => {
    // we could try to reconnect several times before giving up
    // but dont keep it open as it would try to reconnect forever
    // maybe, it depends what error occurs, or we could
    // retry less frequently
    close()
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
