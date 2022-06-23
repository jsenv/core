import { jsenvPluginInjectGlobals } from "@jsenv/core"

export const plugins = [
  jsenvPluginInjectGlobals({
    [new URL("./client/main.js", import.meta.url).href]: () => {
      return {
        __answer__: 42,
      }
    },
  }),
]
