import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
  };
  test("0_js_module", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
      minification: false,
    }));
  // chrome 88 has constructables stylesheet
  // but cannot use js modules due to versioning via importmap (as it does not have importmap)
  test("1_js_module_fallback_css_minified", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "88" },
      minification: {
        js_module: false,
        js_classic: false,
        css: true,
      },
    }));
  // chrome 60 cannot use <script type="module"> nor constructable stylesheet
  test("2_js_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "60" },
      minification: false,
    }));
  // chrome 60 + no bundling
  test("3_js_module_fallback_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "64" },
    }));
});

const actual = {
  jsModule: await executeBuildHtmlInBrowser(
    new URL("./output/0_js_module/build/", import.meta.url),
  ),
  jsModuleFallbackCssMinified: await executeBuildHtmlInBrowser(
    new URL(
      "./output/1_js_module_fallback_css_minified/build/",
      import.meta.url,
    ),
  ),
  jsModuleFallback: await executeBuildHtmlInBrowser(
    new URL("./output/2_js_module_fallback/build/", import.meta.url),
  ),
  jsModuleFallbackNoBundling: await executeBuildHtmlInBrowser(
    new URL(
      "./output/3_js_module_fallback_no_bundling/build/",
      import.meta.url,
    ),
  ),
};
const expect = {
  jsModule: {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("window.origin/other/jsenv.png?v=467b6542")`,
  },
  jsModuleFallbackCssMinified: {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("window.origin/other/jsenv.png?v=467b6542")`,
  },
  jsModuleFallback: {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("window.origin/other/jsenv.png?v=467b6542")`,
  },
  jsModuleFallbackNoBundling: {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("window.origin/other/jsenv.png?v=467b6542")`,
  },
};
assert({ actual, expect });
