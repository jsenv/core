import { startDevServer } from "@jsenv/core"

export const devServer = await startDevServer({
  rootDirectoryUrl: new URL("../", import.meta.url),
  port: 3457,
  // protocol: "https",
  clientAutoreload: false,
  explorer: {
    groups: {
      tests: {
        "tests/**/*.html": true,
      },
    },
  },
})
