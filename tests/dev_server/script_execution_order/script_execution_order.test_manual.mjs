// use file server to test browser behaviour without jsenv
// import { startFileServer } from "@jsenv/core/tests/start_file_server.js"

// await startFileServer({
//   rootDirectoryUrl: new URL("./client/", import.meta.url),
//   debug: true,
// })

import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  keepProcessAlive: true,
});
