/**
 * TODO:
 *
 * - all build logs should be order so that they don't overlap (they are done in parallel)
 * so we need to keep an order (like we do when tests are executing for instance)
 *
 * - gather all build file content before actually writing the on the filesystem
 *
 * - properly wait for a build when build depends on each other
 * (in the spirit of sub builds)
 *
 * each entry point must check if one of the file it references is part of an other build
 * (it's easy to do, we have the list of entry point urls and we can check if the file is in the list)
 * and wait for the corresponding build promise)
 *
 *
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        buildRelativeUrl: "main_build.js",
        runtimeCompat: { node: "20" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
