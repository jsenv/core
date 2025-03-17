import { startFileServer } from "@jsenv/core/tests/start_file_server.js";

await startFileServer({
  rootDirectoryUrl: import.meta.resolve("./client/"),
  debug: true,
});
