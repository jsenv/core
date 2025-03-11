import { build } from "@jsenv/core";

import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.css": "main.css" },
    bundling: false,
    minification: false,
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
});
