import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  htmlSupervisor: false,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
  },
})
