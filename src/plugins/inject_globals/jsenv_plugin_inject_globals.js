import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { isWebWorkerUrlInfo } from "@jsenv/core/src/omega/web_workers.js"

export const jsenvPluginInjectGlobals = (globals = {}) => {
  if (Object.keys(globals).length === 0) {
    return []
  }
  const injectGlobals = (urlInfo) => {
    const magicSource = createMagicSource(urlInfo.content)
    const globalName = isWebWorkerUrlInfo(urlInfo) ? "self" : "window"
    magicSource.prepend(
      `Object.assign(${globalName}, ${JSON.stringify(globals, null, "  ")});`,
    )
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    transformUrlContent: {
      js_classic: injectGlobals,
      js_module: injectGlobals,
    },
  }
}
