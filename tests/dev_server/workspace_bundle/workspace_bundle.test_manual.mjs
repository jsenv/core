import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourcemaps: "none",
  logLevel: "debug",
  serverLogLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  outDirectoryUrl: import.meta.resolve("./.jsenv/"),
  keepProcessAlive: true,
  port: 8888,
  clientAutoreloadOnServerRestart: false,
  dropToOpen: false,
  supervisor: false,
  ribbon: false,
  clientAutoreload: false,
});
