import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  },
  plugins: [jsenvPluginExplorer()],
});
