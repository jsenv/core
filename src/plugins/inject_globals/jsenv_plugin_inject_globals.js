import { injectGlobals } from "./inject_globals.js"

export const jsenvPluginInjectGlobals = (urlAssociations) => {
  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    transformUrlContent: async (urlInfo) => {
      const url = Object.keys(urlAssociations).find((url) => {
        return url === urlInfo.url
      })
      if (!url) {
        return null
      }
      let globals = urlAssociations[url]
      if (typeof globals === "function") {
        globals = await globals()
      }
      if (Object.keys(globals).length === 0) {
        return null
      }
      return injectGlobals(urlInfo, globals)
    },
  }
}
