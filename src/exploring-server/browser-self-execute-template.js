import { EventSource, location } from "global"
// eslint-disable-next-line import/no-unresolved
import { fileRelativePath } from "/.jsenv/browser-self-execute-static-data.js"
import { loadUsingScript } from "../loadUsingScript.js"
import { fetchUsingXHR } from "../browser-platform-service/browser-platform/fetchUsingXHR.js"

// eslint-disable-next-line import/newline-after-import
;(async () => {
  const { body } = await fetchUsingXHR("/.jsenv/browser-self-execute-dynamic-data.json")
  const { compileServerOrigin } = JSON.parse(body)

  if (typeof EventSource === "function") {
    const eventSource = new EventSource(compileServerOrigin, { withCredentials: true })

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
      if (e.origin !== compileServerOrigin) {
        return
      }
      // const fileChanged = e.data
      location.reload()
    })
  }

  await loadUsingScript(`${compileServerOrigin}/.jsenv/browser-platform.js`)
  const { __browserPlatform__ } = window

  const { relativePathToCompiledHref, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })

  await executeFile(relativePathToCompiledHref(fileRelativePath), { errorNotification: true })
})()
