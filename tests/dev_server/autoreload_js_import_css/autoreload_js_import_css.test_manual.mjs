import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  sourceMainFilePath: "main.html",
  supervisor: false,
  transpilation: {
    importAttributes: {
      css: true,
    },
  },
  clientAutoreload: {
    clientServerEventsConfig: {
      logs: true,
    },
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  sourcemaps: "none",
});
