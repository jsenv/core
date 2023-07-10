import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  supervisor: false,
  transpilation: {
    importAssertions: {
      css: true,
    },
  },
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: false,
    },
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  sourcemaps: "none",
});
