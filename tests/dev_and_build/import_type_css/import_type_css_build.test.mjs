import { build, startBuildServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = async ({ runtimeCompat, minification }) => {
  await build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    runtimeCompat,
    minification,
  });
  const buildServer = await startBuildServer({
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  return executeHtml(`${buildServer.origin}/main.html`);
};

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () =>
    run({
      runtimeCompat: { chrome: "89" },
      minification: false,
    }));
  // chrome 88 has constructables stylesheet
  // but cannot use js modules due to versioning via importmap (as it does not have importmap)
  test("1_js_module_fallback_css_minified", () =>
    run({
      runtimeCompat: { chrome: "88" },
      minification: {
        js_module: false,
        js_classic: false,
        css: true,
      },
    }));
  // chrome 60 cannot use <script type="module"> nor constructable stylesheet
  test("2_js_module_fallback", () =>
    run({
      runtimeCompat: { chrome: "60" },
      minification: false,
    }));
  // chrome 60 + no bundling
  test("3_js_module_fallback_no_bundling", () =>
    run({
      runtimeCompat: { chrome: "64" },
    }));
});
