import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "debug",
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  sourceMainFilePath: "main.html",
});
