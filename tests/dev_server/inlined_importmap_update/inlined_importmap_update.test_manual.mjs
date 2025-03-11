import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "warn",
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  sourceMainFilePath: "main.html",
  clientAutoreload: false,
  ribbon: false,
  supervisor: false,
  sourcemaps: "none",
  port: 5467,
});
