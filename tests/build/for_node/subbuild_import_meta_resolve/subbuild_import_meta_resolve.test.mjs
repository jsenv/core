import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async () => {
  await build({
    logs: {
      disabled: true,
    },
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./index.js": "index.js" },
    runtimeCompat: {
      node: "20",
    },
    bundling: false,
    minification: false,
    versioning: false,
    // bundling: false,
    subbuilds: [
      {
        sourceDirectoryUrl: import.meta.resolve("./source/"),
        buildDirectoryUrl: import.meta.resolve("./build/client_built/"),
        entryPoints: {
          "./client/main.html": "main.html",
        },
        runtimeCompat: {
          chrome: "89",
        },
        bundling: false,
        minification: false,
        versioning: false,
      },
    ],
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});
