import { startDevServer } from "@jsenv/core"

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  explorer: {
    groups: {
      main: {
        "./**/*.html": true,
        "./**/*.test.html": false,
      },
      tests: {
        "./**/*.test.html": true,
      },
    },
  },
})
