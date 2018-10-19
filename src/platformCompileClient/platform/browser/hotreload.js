import { HOTRELOAD, HOTRELOAD_SSE_ROOT } from "./server.js"
import { hotreloadPredicate } from "./hotreloadPredicate.js"

if (HOTRELOAD) {
  const eventSource = new window.EventSource(HOTRELOAD_SSE_ROOT, { withCredentials: true })
  eventSource.onerror = () => {
    // we could try to reconnect several times before giving up
    // but dont keep it open as it would try to reconnect forever
    eventSource.close()
  }
  eventSource.addEventListener("file-changed", (e) => {
    if (e.origin !== HOTRELOAD_SSE_ROOT) {
      return
    }
    const fileChanged = e.data
    if (hotreloadPredicate(fileChanged)) {
      // we cannot just System.delete the file because the change may have any impact, we have to reload
      window.location.reload()
    }
  })
}
