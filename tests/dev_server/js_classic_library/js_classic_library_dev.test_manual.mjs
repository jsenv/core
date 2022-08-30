import { startDevServer } from "@jsenv/core"

startDevServer({
  logLevel: "info",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  clientAutoreload: false,
  supervisor: false,
})
