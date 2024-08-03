import { build } from "@jsenv/core";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = ({ runtimeCompat, sourcemaps }) => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    versioning: true,
    runtimeCompat,
    sourcemaps,
  });
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  // can use <script type="module">
  test("0_js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
    }));
  // cannot use <script type="module">
  test("1_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "60" },
    }));
  // can use <script type="module"> + sourcemap
  test("2_js_module_sourcemaps_file", () =>
    run({
      runtimeCompat: { chrome: "89" },
      sourcemaps: "file",
    }));
});
