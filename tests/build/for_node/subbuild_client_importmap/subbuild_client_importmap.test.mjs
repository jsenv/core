import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = async ({ http }) => {
  await build({
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js": {
        runtimeCompat: { node: "20" },
      },
      "./client/main.html": {
        runtimeCompat: { chrome: "89" },
        http,
      },
    },
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_without_http", () =>
    run({
      http: false,
    }));

  test("1_with_http", () =>
    run({
      http: true,
    }));
});
