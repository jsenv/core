import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await startDevServer({
  port: 3589,
  acceptAnyIp: true,
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  plugins: [
    jsenvPluginExplorer({
      groups: {
        main: {
          "./main.html": true,
        },
      },
    }),
    jsenvPluginReact({ refreshInstrumentation: true }),
  ],
});
