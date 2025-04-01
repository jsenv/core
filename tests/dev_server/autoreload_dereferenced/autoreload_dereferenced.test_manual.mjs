import { startDevServer } from "@jsenv/core";

await startDevServer({
  port: 5674,
  logLevel: "info",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
  ribbon: false,
  supervisor: false,
});
