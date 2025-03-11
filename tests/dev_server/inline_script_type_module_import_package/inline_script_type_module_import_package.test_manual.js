import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  serverLogLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  keepProcessAlive: true,
  port: 5678,
  ribbon: false,
  sourcemaps: "none",
  // supervisor: false,
  // clientAutoreload: false,
});
