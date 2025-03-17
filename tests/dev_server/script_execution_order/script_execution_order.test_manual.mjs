// use file server to test browser behaviour without jsenv
// import { startFileServer } from "@jsenv/core/tests/start_file_server.js"

// await startFileServer({
//   rootDirectoryUrl: import.meta.resolve("./client/"),
//   debug: true,
// })

import { startDevServer } from "@jsenv/core";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
  keepProcessAlive: true,
});
