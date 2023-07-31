import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginExplorer({
      pathname: "/explore",
      groups: {
        "main files": {
          "./**/*.html": true,
          "./**/*.test.html": false,
        },
        "spec files": {
          "./**/*.test.html": true,
        },
      },
    }),
  ],
});
