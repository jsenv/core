import { startTestServer } from "@jsenv/pwa/tests/start_test_server.mjs";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startTestServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  supervisor: false,
  clientAutoreload: true,
  plugins: [
    jsenvPluginExplorer({
      groups: {
        client: {
          "./*.html": true,
        },
      },
    }),
  ],
});
