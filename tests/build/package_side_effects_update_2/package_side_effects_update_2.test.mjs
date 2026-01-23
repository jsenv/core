/**
 * This test checks that the package side effects are updated correctly when
 * the project suddendly includes file having side effects
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import {
  replaceFileStructureSync,
  updateJsonFileSync,
} from "@jsenv/filesystem";
import { snapshotTests } from "@jsenv/snapshot";

const run = async (packageSideEffects) => {
  snapshotTests.ignoreSideEffects(() => {
    replaceFileStructureSync({
      from: import.meta.resolve("./fixtures/"),
      to: import.meta.resolve("./git_ignored/"),
    });
    updateJsonFileSync(import.meta.resolve("./git_ignored/package.json"), {
      sideEffects: packageSideEffects,
    });
  });

  await build({
    sourceDirectoryUrl: import.meta.resolve("./git_ignored/"),
    buildDirectoryUrl: import.meta.resolve("./git_ignored/build/"),
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
  test("0_package_side_effects_undefined", () => run(undefined));

  test("1_package_side_effects_false", () => run(false));

  test("2_package_side_effects_empty_array", () => run([]));
});
