import {
  jsenvDirectoryRelativeUrl,
  livereloading,
  // eslint-disable-next-line import/no-unresolved
} from ".jsenv/env.js"
// cannot get fileRelativeUrl
// from the env because it's something that
// changes for every file
// however we could get it using importReplaceMap
import { fileRelativeUrl } from "somewhere"
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

  const dynamicDataFileRemoteUrl = `${window.origin}/${jsenvDirectoryRelativeUrl}.jsenv/browser-self-execute-dynamic-data.json`
  const { body } = await fetchUsingXHR(dynamicDataFileRemoteUrl, {
    credentials: "include",
  })
  const { compileServerOrigin } = JSON.parse(body)

  const browserPlatformCompiledFileRemoteUrl = `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}browser-platform.js`
  await loadUsingScript(browserPlatformCompiledFileRemoteUrl)
  const { __browserPlatform__ } = window

  const { compileDirectoryRemoteUrl, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  const compiledFileRemoteUrl = `${compileDirectoryRemoteUrl}${fileRelativeUrl}`
  await executeFile(compiledFileRemoteUrl, {
    errorNotification: true,
    executionId: fileRelativeUrl,
  })
})()
