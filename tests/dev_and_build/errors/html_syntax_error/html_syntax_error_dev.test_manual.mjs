import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  }
});
