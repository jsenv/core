import { startDevServer } from "@jsenv/core"

export const devServer = await startDevServer({
  rootDirectoryUrl: new URL("../", import.meta.url),
  explorer: {
    groups: {
      test: {
        "tests/**/*.html": true,
      },
    },
  },
})
