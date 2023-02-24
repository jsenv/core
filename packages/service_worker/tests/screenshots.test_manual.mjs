import { startTestServer } from "@jsenv/pwa/tests/start_test_server.mjs"

await startTestServer({
  logLevel: "info",
  serverLogLevel: "info",
  rootDirectoryUrl: new URL("./project/src/", import.meta.url),
  supervisor: false,
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
    "./**/main.html": false,
    "./**/animal.svg": false,
    "./**/sw.js": false,
  },
  clientAutoreload: false,
  cacheControl: false,
  explorer: {
    groups: {
      client: {
        "./*.html": true,
      },
    },
  },
})
