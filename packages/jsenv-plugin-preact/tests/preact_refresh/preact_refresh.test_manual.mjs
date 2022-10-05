import { startDevServer } from "@jsenv/core"
import { jsenvPluginPreact } from "@jsenv/plugin-preact"

startDevServer({
  port: 5678,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginPreact({
      refresh: true,
    }),
  ],
  sourcemaps: "file",
  clientFiles: {
    "./**": true,
  },
  explorer: {
    groups: {
      client: {
        "./*.html": true,
      },
    },
  },
})
