/**
 * Ensure comments inside CSS and JS files are removed even when minifcation is disabled.
 * HTML comments are preserved because they are often used by backend even after build
 * to inject things into the HTML before serving it.
 *
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = () => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        runtimeCompat: { chrome: "89" },
        minification: false,
        packageSideEffects: false,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
