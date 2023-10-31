import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("client/", import.meta.url),
  sourceMainFilePath: "main.html",
});
