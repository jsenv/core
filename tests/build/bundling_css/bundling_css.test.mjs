import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async () => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./elements.css": "elements.css",
    },
    minification: false,
  });
  buildDirectorySnapshot.compare();
};

await test();
