import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ runtimeCompat }) => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        minification: false,
        runtimeCompat,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("chrome_0_import_meta_resolve", () =>
    run({
      runtimeCompat: { chrome: "107" },
    }));
  test("chrome_1_import_meta_resolve_fallback", () =>
    run({
      runtimeCompat: { chrome: "106" },
    }));
});
