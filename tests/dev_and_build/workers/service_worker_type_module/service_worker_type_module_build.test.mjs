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
    ...params,
  });
  buildDirectorySnapshot.compare();
};

if (process.platform === "darwin") {
  // support + bundling
  await test({
    name: "1",
    runtimeCompat: { chrome: "80" },
    minification: false,
    versioning: false, // to prevent importmap forcing fallback on js classic
  });
  // support + no bundling
  await test({
    name: "2",
    runtimeCompat: { chrome: "80" },
    bundling: false,
    minification: false,
    versioning: false, // to prevent importmap forcing fallback on js classic
  });
  // no support for { type: "module" } on service worker
  await test({
    name: "3",
    runtimeCompat: { chrome: "79" },
    minification: false,
  });
  // no support for { type: "module" } on service worker + no bundling
  await test({
    name: "4",
    runtimeCompat: { chrome: "79" },
    bundling: false,
    minification: false,
  });
}
