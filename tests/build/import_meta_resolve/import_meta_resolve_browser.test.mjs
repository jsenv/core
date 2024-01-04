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
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./index.js": "index.js",
    },
    minification: false,
    runtimeCompat,
  });
  buildDirectorySnapshot.compare();
};

await test("chrome_not_supported", {
  runtimeCompat: { chrome: "106" },
});
await test("chrome_supported", {
  runtimeCompat: { chrome: "107" },
});
