import { memoize } from "@jsenv/core/src/internal/memoize.js"
import { fetchUrl } from "@jsenv/core/src/internal/browser_utils/fetch_browser.js"
import { fetchAndEval } from "@jsenv/core/src/internal/browser_utils/fetch_and_eval.js"

import { initHtmlSupervisor } from "../html_supervisor.js"
import { installBrowserErrorStackRemapping } from "./browser_error_stack_remap.js"
import { createBrowserClient } from "./browser_client_factory.js"

const getCompileProfilePromise = memoize(async () => {
  const compileServerOrigin = document.location.origin
  const compileServerResponse = await fetchUrl(
    `${compileServerOrigin}/__jsenv_compile_profile__`,
  )
  const compileServerMeta = await compileServerResponse.json()
  return compileServerMeta
})

const getErrorTransformer = memoize(async () => {
  if (!Error.captureStackTrace) {
    return null
  }
  const {
    errorStackRemapping,
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
  } = await getCompileProfilePromise()
  if (!errorStackRemapping) {
    return null
  }
  const compileServerOrigin = document.location.origin
  await fetchAndEval(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
  const { SourceMapConsumer } = window.sourceMap
  SourceMapConsumer.initialize({
    "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
  })
  const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
    SourceMapConsumer,
  })
  return async (error) => {
    // code can throw something else than an error
    // in that case return it unchanged
    if (!error || !(error instanceof Error)) return error
    const originalStack = await getErrorOriginalStackString(error)
    error.stack = originalStack
    return error
  }
})

const getBrowserClient = memoize(async () => {
  const { jsenvDirectoryRelativeUrl, importDefaultExtension } =
    await getCompileProfilePromise()
  return createBrowserClient({
    jsenvDirectoryRelativeUrl,
    importDefaultExtension,
  })
})

const htmlSupervisor = initHtmlSupervisor({
  errorTransformer: async (e) => {
    const transformer = await getErrorTransformer()
    return transformer ? transformer(e) : e
  },
})
window.__html_supervisor__.setHtmlSupervisor(htmlSupervisor)

const superviseScriptTypeModule = ({ src }) => {
  htmlSupervisor.addExecution({
    src,
    currentScript: document.currentScript,
    promise: (async () => {
      const browserClient = await getBrowserClient()
      return browserClient.import(src)
    })(),
  })
}
window.__html_supervisor__.superviseScriptTypeModule = superviseScriptTypeModule
