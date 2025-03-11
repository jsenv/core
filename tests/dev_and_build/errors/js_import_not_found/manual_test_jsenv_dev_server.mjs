import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  },
  port: 6578,
});
