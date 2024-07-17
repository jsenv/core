import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../client/", import.meta.url),
  port: 3456,
});
