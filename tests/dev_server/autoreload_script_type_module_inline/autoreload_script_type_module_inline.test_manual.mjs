import { startDevServer } from "@jsenv/core";

await startDevServer({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  clientFiles: {
    "./**": true,
    "./**/.*/": false,
  },
  supervisor: {
    logs: true,
  },
});
