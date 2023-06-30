import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "debug",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  supervisor: false,
  transpilation: {
    importAssertions: {
      css: true,
    },
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  sourcemaps: "none",
});
