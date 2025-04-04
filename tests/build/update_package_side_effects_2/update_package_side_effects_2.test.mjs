/**
 * This test checks that the package side effects are updated correctly when
 * the project suddendly includes file having side effects
 *
 *
 * TODO: if the root package.json does not specify side effects we can't
 * set side effects ourselves because project may have side effects
 * it's only when root package says sidEffects: false or [] that we can do all of this
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
