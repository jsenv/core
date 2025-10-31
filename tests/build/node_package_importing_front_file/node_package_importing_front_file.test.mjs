import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        buildRelativeUrl: "./index_after_build.js",
        mode: "package",
        runtimeCompat: { node: "20.0" },
      },
      "./client/file.js": {
        buildRelativeUrl: "./client/dir/file.js",
        runtimeCompat: { chrome: "89" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () => run());
});
