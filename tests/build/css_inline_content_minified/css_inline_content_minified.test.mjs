import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => {
    const jsenvSrcDirectoryUrl = new URL("../../../src/", import.meta.url);
    return build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      runtimeCompat: {
        chrome: "64",
        edge: "79",
        firefox: "67",
        safari: "11.3",
      },
      bundling: {
        js_module: {
          chunks: {
            vendors: {
              "**/node_modules/": true,
              [jsenvSrcDirectoryUrl]: true,
            },
          },
        },
      },
    });
  });
});
