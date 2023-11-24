import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async ({ name, ...params }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  buildDirectorySnapshot.compare();
};

await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  bundling: {
    js_module: {
      chunks: {
        vendors: { "./dep.js": true },
      },
    },
  },
  minification: false,
});
