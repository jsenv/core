import { startDevServer } from "@jsenv/core"

await startDevServer({
  logLevel: "info",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  port: 5432,
})
