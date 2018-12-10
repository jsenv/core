import EventSource from "eventsource"

/*
hot reloading will work that way:

we listen for file change.
we track file currently being executed.
we create a restart controller per file execution
we create a cancel token per file execution

if the file is modified while being executed we call the restart controller.
if the file is executed we call cancel on file execution in case platform must be closed.
Because the current running file may have side effect until it's completely closed
we wait for cancel to resolve before calling executeFile.
*/

export const hotreloadOpen = (url, callback) => {
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
