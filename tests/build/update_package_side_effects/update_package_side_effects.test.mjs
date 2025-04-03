/**
 * This test checks that the package side effects are updated correctly when a source file is declared as having side effect
 * in the package.json file.
 *
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./root/"),
    buildDirectoryUrl: import.meta.resolve("./root/build/"),
    entryPoints: {
      "./main.js": {
        runtimeCompat: { chrome: "89" },
        minification: false,
        versioning: false,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
