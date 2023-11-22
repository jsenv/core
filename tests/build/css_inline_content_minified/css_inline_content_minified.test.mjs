import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const jsenvSrcDirectoryUrl = new URL("../../../src/", import.meta.url);
await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  runtimeCompat: {
    chrome: "64",
    edge: "79",
    firefox: "67",
    safari: "11.3",
  },
  bundling: {
    js_module: {
      chunks: {
        vendors: {
          "**/node_modules/": true,
          [jsenvSrcDirectoryUrl]: true,
        },
      },
    },
  },
});
takeDirectorySnapshot(
  new URL("./dist/", import.meta.url),
  new URL("./snapshots/", import.meta.url),
);
