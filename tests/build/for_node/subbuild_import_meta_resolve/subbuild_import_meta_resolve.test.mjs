/**
 *
 */

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ bundling, clientBase }) => {
  await build({
    logs: {
      level: "warn",
    },
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        runtimeCompat: { node: "20" },
        bundling,
        versioning: false,
        minification: false,
        packageSideEffects: false,
      },
      "./client/main.html": {
        runtimeCompat: { chrome: "89" },
        bundling,
        versioning: false,
        minification: false,
        base: clientBase,
        packageSideEffects: false,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_no_bundling", () =>
    run({
      bundling: false,
    }));

  test("1_no_bundling_relative_base", () =>
    run({
      bundling: false,
      clientBase: "./",
    }));

  test("2_with_bundling", () =>
    run({
      bundling: true,
    }));
});
