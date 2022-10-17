import { startDevServer } from "@jsenv/core"

export const devServer = await startDevServer({
  rootDirectoryUrl: new URL("../", import.meta.url),
  explorableConfig: {
    test: {
      "tests/**/*.html": true,
    },
  },
})
