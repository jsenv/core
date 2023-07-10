import { startDevServer } from "@jsenv/core";

await startDevServer({
  port: 5674,
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  ribbon: false,
  supervisor: false,
});
