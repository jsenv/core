import { startTestServer } from "@jsenv/pwa/tests/start_test_server.mjs"

await startTestServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  supervisor: false,
  clientAutoreload: true,
  explorer: {
    groups: {
      client: {
        "./*.html": true,
      },
    },
  },
})
