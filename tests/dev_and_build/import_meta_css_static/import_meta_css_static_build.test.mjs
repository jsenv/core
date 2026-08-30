import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ minification, preserveComments }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        runtimeCompat: { chrome: "89" },
        bundling: false,
        versioning: false,
        minification,
        preserveComments,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("strip_comments", () =>
    run({ minification: false, preserveComments: false }));

  test("minification", () => run({ minification: true }));
});
