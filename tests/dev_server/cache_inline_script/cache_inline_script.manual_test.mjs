import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
  port: 5433,
  ribbon: false,
  clientAutoreload: false,
  supervisor: false,
});
