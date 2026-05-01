import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        runtimeCompat: { chrome: "89" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("preconnect_kept_in_build", () => run());
});
