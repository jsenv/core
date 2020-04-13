// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"

// TODO: find how to convert this import
// into a dynamic import inside if (Error.prepareStackTrace)
// until then browser without it like firefox will download the file and never use it
import { installBrowserErrorStackRemapping } from "../error-stack-remapping/installBrowserErrorStackRemapping.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../CONSTANTS.js"
import { fetchAndEvalUsingScript } from "../fetchAndEvalUsingScript.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"

const { jsenvDirectoryRelativeUrl, outDirectoryRelativeUrl } = env
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

  const dynamicDataFileRemoteUrl = `${window.origin}/${jsenvDirectoryRelativeUrl}browser-execute-dynamic-data.json`
  const dynamicDataFileResponse = await fetchUsingXHR(dynamicDataFileRemoteUrl, {
    credentials: "include",
  })
  const dynamicData = await dynamicDataFileResponse.json()
  const {
    browserRuntimeFileRelativeUrl,
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
    compileServerOrigin,
  } = dynamicData

  const browserRuntimeCompiledFileRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${COMPILE_ID_GLOBAL_BUNDLE}/${browserRuntimeFileRelativeUrl}`
  await fetchAndEvalUsingScript(browserRuntimeCompiledFileRemoteUrl)
  const { __browserRuntime__ } = window

  const { compileDirectoryRemoteUrl, executeFile } = __browserRuntime__.create({
    compileServerOrigin,
  })
  const compiledFileRemoteUrl = `${compileDirectoryRemoteUrl}${fileRelativeUrl}`

  let errorTransform = (error) => error

  if (Error.captureStackTrace) {
    await fetchAndEvalUsingScript(`/${sourcemapMainFileRelativeUrl}`)
    const { SourceMapConsumer } = window.sourceMap
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `/${sourcemapMappingFileRelativeUrl}`,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
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
