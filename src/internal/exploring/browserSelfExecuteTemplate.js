import {
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  // eslint-disable-next-line import/no-unresolved
} from "/.jsenv/env.js"

// TODO: find how to convert this import
// into a dynamic import inside if (Error.prepareStackTrace)
// until then browser without it like firefox will download the file and never use it
import { installBrowserErrorStackRemapping } from "@jsenv/error-stack-sourcemap/src/installBrowserErrorStackRemapping/installBrowserErrorStackRemapping.js"

import { fetchAndEvalUsingScript } from "internal/fetchAndEvalUsingScript.js"
import { fetchUsingXHR } from "internal/fetchUsingXHR.js"

const { EventSource, location } = window
// TODO: find something for old browsers where URLSearchParams is not available
const fileRelativeUrl = new URLSearchParams(location.search).get("file")

// eslint-disable-next-line import/newline-after-import
;(async () => {
  if (typeof EventSource === "function") {
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

  const dynamicDataFileRemoteUrl = `${window.origin}/${jsenvDirectoryRelativeUrl}browser-self-execute-dynamic-data.json`
  const { body } = await fetchUsingXHR(dynamicDataFileRemoteUrl, {
    credentials: "include",
  })
  const { compileServerOrigin } = JSON.parse(body)

  const browserPlatformCompiledFileRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}otherwise-global-bundle/src/browserPlatform.js`
  await fetchAndEvalUsingScript(browserPlatformCompiledFileRemoteUrl)
  const { __browserPlatform__ } = window

  const { compileDirectoryRemoteUrl, executeFile } = __browserPlatform__.create({
    compileServerOrigin,
  })
  const compiledFileRemoteUrl = `${compileDirectoryRemoteUrl}${fileRelativeUrl}`

  let errorTransform = (error) => error

  if (Error.captureStackTrace) {
    const sourcemapPackageMainFileRemoteUrl = `${compileServerOrigin}/node_modules/source-map/dist/source-map.js`
    await fetchAndEvalUsingScript(sourcemapPackageMainFileRemoteUrl)
    const { SourceMapConsumer } = window.sourceMap
    const sourcemapPackageMappingFileRemoteUrl = `${compileServerOrigin}/node_modules/source-map/lib/mappings.wasm`
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": sourcemapPackageMappingFileRemoteUrl,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
      resolveHref: ({ specifier, importer = compiledFileRemoteUrl }) => {
        return String(new URL(specifier, importer))
      },
      SourceMapConsumer,
    })

    errorTransform = async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    }
  }

  await executeFile(compiledFileRemoteUrl, {
    errorNotification: true,
    executionId: fileRelativeUrl,
    executionExposureOnWindow: true,
    collectNamespace: true,
    collectCoverage: true,
    errorTransform,
  })
})()
