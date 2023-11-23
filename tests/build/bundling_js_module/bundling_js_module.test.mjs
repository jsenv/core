import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const expectedBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    ...params,
  });
  const actualBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualBuildSnapshot, expectedBuildSnapshot);
};

await test({
  minification: false,
});
