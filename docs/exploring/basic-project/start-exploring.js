// eslint-disable-next-line import/no-unresolved
import { startExploring } from "@jsenv/core"

startExploring({
  projectDirectoryUrl: new URL("./", import.meta.url),
  explorableConfig: {
    source: {
      "*.html": true,
      "src/**/*.html": true,
    },
    test: {
      "test/**/*.html": true,
    },
  },
  compileServerPort: 3456,
  livereloading: true,
})
