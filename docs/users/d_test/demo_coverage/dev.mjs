import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  port: 3456,
});
