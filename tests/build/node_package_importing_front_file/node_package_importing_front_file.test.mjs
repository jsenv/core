import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        mode: "package",
        runtimeCompat: { node: "20.0" },
      },
      "./client/file.js": {
        runtimeCompat: { chrome: "90.0" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () => run());
});
