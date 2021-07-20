import { startExploring } from "@jsenv/core"

startExploring({
  projectDirectoryUrl: new URL("./", import.meta.url),
  explorableConfig: {
    source: {
      "./*.html": true,
    },
  },
  compileServerPort: 3456,
  livereloading: true,
})
