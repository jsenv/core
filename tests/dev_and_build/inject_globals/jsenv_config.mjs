import { jsenvPluginInjectGlobals } from "@jsenv/core"

export const plugins = [
  jsenvPluginInjectGlobals({
    "./main.html": (urlInfo, context) => {
      return { __DEMO__: context.dev ? "dev" : "build" }
    },
  }),
]
