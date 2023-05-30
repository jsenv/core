import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

startDevServer({
  port: 5678,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginExplorer({
      groups: {
        client: {
          "./*.html": true,
        },
      },
    }),
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
  sourcemaps: "file",
  clientFiles: {
    "./**": true,
  },
});
