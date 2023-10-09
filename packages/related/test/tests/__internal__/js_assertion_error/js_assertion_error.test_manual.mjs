import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  keepProcessAlive: true,
  port: 5678,
});
