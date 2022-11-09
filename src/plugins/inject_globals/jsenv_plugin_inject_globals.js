import { URL_META } from "@jsenv/url-meta"

import { injectGlobals } from "./inject_globals.js"

export const jsenvPluginInjectGlobals = (rawAssociations) => {
  let resolvedAssociations

  return {
    name: "jsenv:inject_globals",
    appliesDuring: "*",
    init: (context) => {
      resolvedAssociations = URL_META.resolveAssociations(
        { injector: rawAssociations },
        context.rootDirectoryUrl,
      )
    },
    transformUrlContent: async (urlInfo, context) => {
      const { injector } = URL_META.applyAssociations({
        url: urlInfo.url,
        associations: resolvedAssociations,
      })
      if (!injector) {
        return null
      }
      if (typeof injector !== "function") {
        throw new TypeError("injector must be a function")
      }
      const globals = await injector(urlInfo, context)
      if (!globals || Object.keys(globals).length === 0) {
        return null
      }
      return injectGlobals(urlInfo, globals)
    },
  }
}
