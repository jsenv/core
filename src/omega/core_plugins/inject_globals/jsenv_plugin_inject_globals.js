import { createMagicSource } from "@jsenv/core/packages/utils/sourcemap/magic_source.js"

export const jsenvPluginInjectGlobals = (globals = {}) => {
  if (Object.keys(globals).length === 0) {
    return []
  }
  const injectGlobals = (urlInfo) => {
    const magicSource = createMagicSource(urlInfo.content)
    const globalName =
      urlInfo.subtype === "worker" || urlInfo.subtype === "service_worker"
        ? "self"
        : "window"
    magicSource.prepend(
      `Object.assign(${globalName}, ${JSON.stringify(globals, null, "  ")});`,
    )
    return magicSource.toContentAndSourcemap()
  }

  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    transform: {
      js_module: injectGlobals,
      js_classic: injectGlobals,
    },
  }
}
