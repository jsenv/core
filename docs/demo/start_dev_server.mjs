import { startDevServer } from "@jsenv/core"

startDevServer({
  projectDirectoryUrl: new URL("./", import.meta.url),
  explorableConfig: {
    source: {
      "./*.html": true,
    },
  },
  compileServerPort: 3456,
  livereloading: true,
})
