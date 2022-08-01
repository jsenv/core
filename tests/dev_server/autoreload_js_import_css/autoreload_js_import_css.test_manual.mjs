import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  supervisor: false,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
  },
})
