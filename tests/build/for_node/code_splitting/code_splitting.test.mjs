import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async (params) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        buildRelativeUrl: "main_build.js",
        packageSideEffects: false,
        ...params,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // jsenv prioritize isolation over reuse when building for node
  // to reduce to the bare minimum the code needed to call a function
  test("0_node", () =>
    run({
      runtimeCompat: { node: "20" },
    }));

  // jsenv prioritize reuse over isolation when building for browser
  // to reduce code duplication because loading code takes more time in this context
  test("1_browser", () =>
    run({
      runtimeCompat: { chrome: "90" },
      minification: false,
      versioning: false,
    }));
});
