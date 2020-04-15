// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"

// TODO: find how to convert this import to dynamic import inside if (Error.prepareStackTrace)
// until then browser without it like firefox will download the file and never use it
import { installBrowserErrorStackRemapping } from "../error-stack-remapping/installBrowserErrorStackRemapping.js"
import { COMPILE_ID_GLOBAL_BUNDLE } from "../CONSTANTS.js"
import { fetchAndEvalUsingScript } from "../fetchAndEvalUsingScript.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { connectFileChangesEventSource } from "./fileChangesEventSource.js"

const { jsenvDirectoryRelativeUrl, outDirectoryRelativeUrl } = env
const { location } = window
// TODO: find something for old browsers where URLSearchParams is not available
const fileRelativeUrl = new URLSearchParams(location.search).get("file")

// eslint-disable-next-line import/newline-after-import
;(async () => {
  const eventSourceUrl = `${location.origin}/${fileRelativeUrl}`
  connectFileChangesEventSource(eventSourceUrl, {
    onConnect: ({ isReconnection }) => {
      if (isReconnection) {
        console.info(`reconnected to file change event source at ${eventSourceUrl} -> reload page`)
        location.reload()
      } else {
        console.info(`connected to file change event source at ${eventSourceUrl}`)
      }
    },
    onFileChange: (file) => {
      console.info(`${file} changed -> reload page`)
      location.reload()
    },
    onDisconnect: () => {
      console.info(
        `disconnected from file change event source at ${eventSourceUrl} -> trying to reconnect`,
      )
    },
  })

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
