export const open = (url, callback) => {
  if (typeof window.EventSource !== "function") {
    return
  }

  const eventSource = new window.EventSource(url, { withCredentials: true })
  eventSource.onerror = () => {
    // we could try to reconnect several times before giving up
    // but dont keep it open as it would try to reconnect forever
    eventSource.close()
  }
  eventSource.addEventListener("file-changed", (e) => {
    if (e.origin !== url) {
      return
    }
    callback(e.data)
  })
}
