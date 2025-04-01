import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./source/dev/start_dev_server.js": {
        buildRelativeUrl: "./main.js",
        runtimeCompat: { node: "20" },
      },
      "./source/plugins/autoreload/client/autoreload_client.js": {
        buildRelativeUrl: "./client/autoreload/autoreload_client.js",
        runtimeCompat: { chrome: "89" },
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
