import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  supervisor: false,
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: true,
    },
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  sourcemaps: "none",
  port: 5467,
});
