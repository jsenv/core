import { memoize } from "@jsenv/core/src/internal/memoize.js"

import { initHtmlSupervisor } from "../html_supervisor.js"
import { installBrowserErrorStackRemapping } from "./browser_error_stack_remap.js"
import { createBrowserClient } from "./browser_client_factory.js"

const sourcemappingFileUrl = new URL(
  "source-map/lib/mappings.wasm",
  import.meta.url,
)

const getErrorTransformer = memoize(async () => {
  if (!Error.captureStackTrace) {
    return null
  }
  await import("source-map/dist/source-map.js")
  const { SourceMapConsumer } = window.sourceMap
  SourceMapConsumer.initialize({
    "lib/mappings.wasm": sourcemappingFileUrl,
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

const getBrowserClient = memoize(() => {
  return createBrowserClient()
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
    type: "js_module",
    currentScript: document.currentScript,
    src,
    promise: (async () => {
      const browserClient = await getBrowserClient()
      return browserClient.import(src)
    })(),
  })
}
window.__html_supervisor__.superviseScriptTypeModule = superviseScriptTypeModule
