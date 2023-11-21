import { takeDirectorySnapshot } from "@jsenv/snapshots";

import { build } from "@jsenv/core";

await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./elements.css": "elements.css",
  },
  minification: false,
});
takeDirectorySnapshot(
  new URL("./dist/", import.meta.url),
  new URL("./snapshots/", import.meta.url),
);
