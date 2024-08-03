import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

import { build } from "@jsenv/core";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    minification: false,
  };

  // can use <script type="module">
  test("0_js_module", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
    }));

  // cannot use <script type="module">
  test("1_js_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: {
        chrome: "55",
        edge: "14",
        firefox: "52",
        safari: "11",
      },
    }));
});
