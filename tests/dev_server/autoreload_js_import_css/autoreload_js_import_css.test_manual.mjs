import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  supervisor: false,
  transpilation: {
    importAssertions: {
      css: true,
    },
  },
});
