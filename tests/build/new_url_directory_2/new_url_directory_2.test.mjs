import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

const test = async (params) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.js": "main.js",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  buildDirectorySnapshot.compare();

  // eslint-disable-next-line import/no-unresolved
  const { directoryUrl } = await import("./snapshots/main.js");
  const actual = directoryUrl;
  const expected = new URL("./snapshots/src/", import.meta.url).href;
  assert({ actual, expected });
};

await test({
  directoryReferenceEffect: "copy",
  runtimeCompat: { node: "19" },
  bundling: false,
  minification: false,
});
