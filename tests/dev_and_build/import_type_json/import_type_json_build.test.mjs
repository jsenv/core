import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
  };

  test("0_js_module", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
    }));
  test("1_js_module_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
      bundling: false,
    }));
  test("2_js_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "60" },
    }));
  test("3_js_module_fallback_no_bundling", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "60" },
      bundling: false,
    }));
});

const actual = {
  jsModule: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_js_module")}build/`,
  ),
  jsModuleNoBundling: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_js_module_no_bundling")}build/`,
  ),
  jsModuleFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("2_js_module_fallback")}build/`,
  ),
  jsModuleFallbackNoBundling: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("3_js_module_fallback_no_bundling")}build/`,
  ),
};
const expect = {
  jsModule: {
    data: { answer: 42 },
  },
  jsModuleNoBundling: {
    data: { answer: 42 },
  },
  jsModuleFallback: {
    data: { answer: 42 },
  },
  jsModuleFallbackNoBundling: {
    data: { answer: 42 },
  },
};
assert({ actual, expect });
