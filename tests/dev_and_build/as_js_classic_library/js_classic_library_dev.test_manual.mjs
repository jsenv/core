import { startDevServer } from "@jsenv/core"

startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  clientAutoreload: true,
  supervisor: false,
})
