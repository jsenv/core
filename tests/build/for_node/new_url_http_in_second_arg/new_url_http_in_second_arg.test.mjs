/**
 * When a js file contains a reference to an other file (.html especially)
 * that is not an import it means this file is an entry point
 * and should be built as a standalone file
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./source/", import.meta.url),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./index.js": "index.js" },
    runtimeCompat: {
      node: "20",
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
