import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    ...params,
  });
  buildDirectorySnapshot.compare();
};

await test({
  minification: false,
});
