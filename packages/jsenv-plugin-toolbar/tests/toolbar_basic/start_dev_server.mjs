import { startDevServer } from "@jsenv/core"
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar"

startDevServer({
  rootDirectoryUrl: new URL("./", import.meta.url),
  plugins: [
    jsenvPluginToolbar({
      logLevel: "debug",
    }),
  ],
})
