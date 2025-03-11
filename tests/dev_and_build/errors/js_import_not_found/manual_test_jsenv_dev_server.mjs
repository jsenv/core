import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  },
  port: 6578,
  plugins: [jsenvPluginPreact()],
});
