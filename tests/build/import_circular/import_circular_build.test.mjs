// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        minification: false,
        versioning: false,
        base: "./",
        bundling,
        runtimeCompat: { node: "0" },
        packageSideEffects: false,
      },
    },
  });
  return import(import.meta.resolve("./build/main.js"));
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_with_bundling", () =>
    run({
      bundling: true,
    }));
  test("1_without_bundling", () =>
    run({
      bundling: false,
    }));
});
