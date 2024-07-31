import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
      bundling: false,
      minification: false,
      versioning: false,
    };

    // cannot use <script type="module">
    test("0_js_module_fallback", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "60" },
      }));
  },
  new URL("./output/script_type_module_inline_basic.md", import.meta.url),
);
