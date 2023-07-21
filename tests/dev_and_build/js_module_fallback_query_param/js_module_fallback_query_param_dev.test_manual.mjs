import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "debug",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
});
