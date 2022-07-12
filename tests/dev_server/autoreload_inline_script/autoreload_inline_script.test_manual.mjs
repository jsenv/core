import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  cooldownBetweenFileEvents: 250,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
  },
})
