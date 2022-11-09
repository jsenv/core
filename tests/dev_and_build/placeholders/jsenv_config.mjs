import { jsenvPluginPlaceholders } from "@jsenv/core"

export const plugins = [
  jsenvPluginPlaceholders({
    "./main.js": (urlInfo, context) => {
      return {
        __DEMO__: context.scenarios.dev ? "dev" : "build",
      }
    },
  }),
]
