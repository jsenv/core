import {
  fileRelativeUrl,
  compileDirectoryRelativeUrl,
  livereloading,
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/browser-self-execute-static-data.js"
import { loadUsingScript } from "internal/loadUsingScript.js"
import { fetchUsingXHR } from "internal/fetchUsingXHR.js"

const { EventSource, location } = window
// eslint-disable-next-line import/newline-after-import
;(async () => {
  if (livereloading && typeof EventSource === "function") {
    const eventSourceOrigin = window.location.origin
    const eventSourceHref = `${eventSourceOrigin}/${fileRelativeUrl}`
    const eventSource = new EventSource(eventSourceHref, {
      withCredentials: true,
    })

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
      if (e.origin !== eventSourceOrigin) {
        return
      }
      // const fileChanged = e.data
      location.reload()
    })
  }

  const { body } = await fetchUsingXHR(
    `${window.origin}/${compileDirectoryRelativeUrl}.jsenv/browser-self-execute-dynamic-data.json`,
    {
      credentials: "include",
    },
  )
  const { compileServerOrigin } = JSON.parse(body)

  await loadUsingScript(
    `${compileServerOrigin}/${compileDirectoryRelativeUrl}.jsenv/browser-platform.js`,
  )
  const { __browserPlatform__ } = window

  const { relativeUrlToCompiledUrl, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })

  await executeFile(relativeUrlToCompiledUrl(fileRelativeUrl), {
    errorNotification: true,
    executionId: fileRelativeUrl,
  })
})()
