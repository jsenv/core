import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.css": "main.css",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshotAndCompare(
    new URL("./dist/", import.meta.url),
    new URL("./snapshots/", import.meta.url),
  );
};

await test({
  bundling: false,
  minification: false,
});
