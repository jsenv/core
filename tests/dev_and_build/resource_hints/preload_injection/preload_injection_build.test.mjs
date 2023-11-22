import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async ({ name, ...params }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshotAndCompare(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
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
