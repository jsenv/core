import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  port: 5433,
  ribbon: false,
  clientAutoreload: false,
  supervisor: false,
});
