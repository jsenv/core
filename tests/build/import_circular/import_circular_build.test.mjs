// https://github.com/rollup/rollup/tree/dba6f13132a1d7dac507d5056399d8af0eed6375/test/function/samples/preserve-modules-circular-order

import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ bundling }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./main.js": "main.js" },
    minification: false,
    versioning: false,
    base: "./",
    bundling,
  });
  return import(new URL("./build/main.js", import.meta.url));
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
