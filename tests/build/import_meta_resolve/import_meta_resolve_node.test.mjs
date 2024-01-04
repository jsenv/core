import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

const test = async (filename, { runtimeCompat }) => {
  const snapshotDirectoryUrl = new URL(
    `./snapshots/${filename}/`,
    import.meta.url,
  );
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./node_client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./index.js": "index.js",
    },
    runtimeCompat,
  });
  buildDirectorySnapshot.compare();
};

await test("node_not_supported", {
  runtimeCompat: { node: "20" },
});
await test("node_supported", {
  runtimeCompat: { node: "19" },
});
