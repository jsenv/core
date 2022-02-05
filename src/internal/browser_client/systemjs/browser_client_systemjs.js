import { fetchUrl } from "@jsenv/core/src/internal/browser_utils/fetch_browser.js"
import { fetchAndEval } from "@jsenv/core/src/internal/browser_utils/fetch_and_eval.js"
import { memoize } from "@jsenv/core/src/internal/memoize.js"

import { initHtmlExecution } from "../html_execution.js"

import { createBrowserClient } from "./browser_client_factory.js"
import { installBrowserErrorStackRemapping } from "./browser_error_stack_remap.js"

const htmlExecution = initHtmlExecution()

const superviseSystemJsImport = async (specifier) => {
  htmlExecution.addExecution({
    name: specifier,
    promise: (async () => {
      const browserRuntime = await getBrowserRuntime()
      return browserRuntime.executeFile(specifier, {
        measurePerformance: true,
        collectPerformance: true,
      })
    })(),
    currentScript: document.currentScript,
  })
}

const getBrowserRuntime = memoize(async () => {
  const compileServerOrigin = document.location.origin
  const compileServerResponse = await fetchUrl(
    `${compileServerOrigin}/__jsenv_compile_profile__`,
  )
  const compileServerMeta = await compileServerResponse.json()
  const { jsenvDirectoryRelativeUrl, errorStackRemapping } = compileServerMeta
  const jsenvDirectoryServerUrl = `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}`
  const afterJsenvDirectory = document.location.href.slice(
    jsenvDirectoryServerUrl.length,
  )
  const parts = afterJsenvDirectory.split("/")
  const compileId = parts[0]

  const browserClient = await createBrowserClient({
    compileServerOrigin,
    jsenvDirectoryRelativeUrl,
    compileId,
  })

  if (errorStackRemapping && Error.captureStackTrace) {
    const { sourcemapMainFileRelativeUrl, sourcemapMappingFileRelativeUrl } =
      compileServerMeta
    await fetchAndEval(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
    const { SourceMapConsumer } = window.sourceMap
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
      SourceMapConsumer,
    })
    const errorTransform = async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error
      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    }
    const executeFile = browserClient.executeFile
    browserClient.executeFile = (file, options = {}) => {
      return executeFile(file, { errorTransform, ...options })
    }
  }
  return browserClient
})

window.__jsenv__ = {
  superviseSystemJsImport,
  htmlExecution,
}
