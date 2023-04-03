import { startDevServer } from "@jsenv/core"

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  port: 0,
})
