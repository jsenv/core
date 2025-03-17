import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  },
  plugins: [jsenvPluginExplorer()],
});
