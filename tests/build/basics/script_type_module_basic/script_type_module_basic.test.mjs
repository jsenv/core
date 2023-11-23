import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async ({ name, ...rest }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const expectedBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...rest,
  });
  const actualBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualBuildSnapshot, expectedBuildSnapshot);
};

// can use <script type="module">
await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  bundling: false,
  minification: false,
  versioning: false,
});
// cannot use <script type="module">
await test({
  name: "1_js_module_fallback",
  runtimeCompat: { chrome: "60" },
  bundling: false,
  minification: false,
  versioning: false,
});
