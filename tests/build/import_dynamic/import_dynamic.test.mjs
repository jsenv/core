import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      bundling: false,
      minification: false,
      versioning: false,
    };
    test("0_js_module", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "89" },
      }));
    test("1_js_module_fallback", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "62" },
      }));
  },
  new URL("./output/import_dynamic.md", import.meta.url),
);

const actual = {
  jsModuleResult: await executeBuildHtmlInBrowser(
    new URL(`./output/0_js_module/build/`, import.meta.url),
  ),
  jsModuleFallbackResult: await executeBuildHtmlInBrowser(
    new URL(`./output/1_js_module_fallback/build/`, import.meta.url),
  ),
};
const expect = {
  jsModuleResult: {
    answer: 42,
    nestedFeatureUrl: `/js/nested_feature.js`,
  },
  jsModuleFallbackResult: {
    answer: 42,
    nestedFeatureUrl: `/js/nested_feature.nomodule.js`,
  },
};
assert({ actual, expect });
