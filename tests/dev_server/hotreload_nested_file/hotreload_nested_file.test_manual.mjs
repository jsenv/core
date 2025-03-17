import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "debug",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
});
