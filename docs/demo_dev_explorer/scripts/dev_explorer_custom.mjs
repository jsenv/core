import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  explorer: {
    groups: {
      "main files": {
        "./**/*.html": true,
        "./**/*.test.html": false,
      },
      "spec files": {
        "./**/*.test.html": true,
      },
    },
  },
});
