import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: new URL("./source/", import.meta.url),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        runtimeCompat: { node: "20" },
      },
      "./client/a.js": {
        buildRelativeUrl: "./client/a/a.js",
        runtimeCompat: { chrome: "89" },
      },
      "./client/b.js": {
        buildRelativeUrl: "./client/b/b.js",
        runtimeCompat: { chrome: "89" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
