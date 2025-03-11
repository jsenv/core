import { startFileServer } from "@jsenv/core/tests/start_file_server.js";

await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
  debug: true,
});
