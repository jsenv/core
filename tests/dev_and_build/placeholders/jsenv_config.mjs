import { jsenvPluginPlaceholders } from "@jsenv/core"

export const plugins = [
  jsenvPluginPlaceholders({
    "./main.js": (urlInfo, context) => {
      return {
        __DEMO__: JSON.stringify(context.scenarios.dev ? "dev" : "build"),
      }
    },
  }),
]
