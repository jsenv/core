import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
  },
  clientMainFileUrl: new URL("./client/main.html", import.meta.url),
  supervisor: {
    logs: true,
  },
})
