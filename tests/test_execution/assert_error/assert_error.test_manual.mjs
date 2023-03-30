import { startDevServer } from "@jsenv/core"

const rootDirectoryUrl = new URL("./client/", import.meta.url)
await startDevServer({
  logLevel: "info",
  rootDirectoryUrl,
  port: 3490,
  explorer: {
    groups: {
      client: {
        "**/*": true,
      },
    },
  },
})
