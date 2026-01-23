import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    build({
      sourceDirectoryUrl: import.meta.resolve("./client/"),
      buildDirectoryUrl: import.meta.resolve("./build/"),
      entryPoints: {
        "./src/main.html": {
          buildRelativeUrl: "./main.html",
          bundling: false,
          minification: false,
        },
      },
    }));
});
