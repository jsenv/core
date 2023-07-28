import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "debug",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "./main.html",
  sourceFilesConfig: {
    "./**": true,
    "./**/.*/": false,
  },
  supervisor: {
    logs: true,
  },
});
