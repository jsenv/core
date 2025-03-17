import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    build({
      sourceDirectoryUrl: import.meta.resolve("./client/"),
      buildDirectoryUrl: import.meta.resolve("./build/"),
      entryPoints: { "./src/main.html": "main.html" },
      bundling: false,
      minification: false,
    }));
});
