import { startTestServer } from "@jsenv/pwa/tests/start_test_server.mjs"

await startTestServer({
  logLevel: "info",
  serverLogLevel: "info",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  supervisor: false,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
    "./**/sw.js": false,
  },
  clientAutoreload: true,
  explorer: {
    groups: {
      client: {
        "./*.html": true,
      },
    },
  },
})
