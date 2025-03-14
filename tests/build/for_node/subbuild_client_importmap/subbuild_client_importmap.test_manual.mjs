import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ http }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./main.js": "main.js" },
    minification: false,
    runtimeCompat: { node: "20" },
    subbuilds: [
      {
        buildDirectoryUrl: import.meta.resolve("./build/client/"),
        entryPoints: { "./client/main.html": "main.html" },
        runtimeCompat: { chrome: "89" },
        http,
        bundling: { js_module: { chunks: false } },
      },
    ],
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_without_http", () => run({ http: false }));

  test.ONLY("1_with_http", () => run({ http: true }));
});
