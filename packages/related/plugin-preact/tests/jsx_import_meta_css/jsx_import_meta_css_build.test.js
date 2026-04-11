import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const run = async ({ runtimeCompat }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./index.js": {
        bundling: true,
        runtimeCompat,
        minification: false,
        plugins: [jsenvPluginPreact()],
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
});
