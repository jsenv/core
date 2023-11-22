import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.css": "main.css",
  },
  minification: false,
});
takeDirectorySnapshotAndCompare(
  new URL("./dist/", import.meta.url),
  new URL("./snapshots/", import.meta.url),
);
