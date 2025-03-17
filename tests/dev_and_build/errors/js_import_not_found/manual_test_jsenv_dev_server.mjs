import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  },
  port: 6578,
  plugins: [jsenvPluginPreact()],
});
