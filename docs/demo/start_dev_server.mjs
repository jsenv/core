import { startDevServer } from "@jsenv/core"

startDevServer({
  projectDirectoryUrl: new URL("./", import.meta.url),
  explorableConfig: {
    source: {
      "./*.html": true,
    },
  },
  port: 3456,
  livereloading: true,
})
