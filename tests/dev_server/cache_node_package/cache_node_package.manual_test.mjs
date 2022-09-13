import { startDevServer } from "@jsenv/core"

await startDevServer({
  logLevel: "info",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  port: 5433,
  clientMainFileUrl: new URL("./client/main.html", import.meta.url),
})
