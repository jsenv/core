import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
  keepProcessAlive: true,
  port: 5678,
  ribbon: false,
  // clientAutoreload: false,
});
