import { startDevServer } from "@jsenv/core";

await startDevServer({
  serverLogLevel: "debug",
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  sourceMainFilePath: "./main.html",
  sourceFilesConfig: {
    "./**": true,
    "./**/.*/": false,
  },
  supervisor: {
    logs: true,
  },
});
