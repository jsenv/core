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
      outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
      minification: false,
    };
    test("0_js_module", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "89" },
      }));
    test("1_js_module_fallback", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "60" },
      }));
    test("2_js_module_fallback_no_bundling", () =>
      build({
        ...testParams,
        runtimeCompat: { chrome: "60" },
        bundling: false,
      }));
  },
  new URL("./output/script_type_module_inline.md", import.meta.url),
);

const actual = {
  jsModule: await executeBuildHtmlInBrowser(
    new URL("./output/0_js_module/build/", import.meta.url),
  ),
  jsModuleFallback: await executeBuildHtmlInBrowser(
    new URL("./output/1_js_module_fallback/build/", import.meta.url),
  ),
  jsModuleFallbackNoBundling: await executeBuildHtmlInBrowser(
    new URL(
      "./output/2_js_module_fallback_no_bundling/build/",
      import.meta.url,
    ),
  ),
};
const expect = {
  jsModule: {
    answer: 42,
    url: "window.origin/main.html",
  },
  jsModuleFallback: {
    answer: 42,
    url: "window.origin/main.html__inline_script__1",
  },
  jsModuleFallbackNoBundling: {
    answer: 42,
    url: "window.origin/main.html__inline_script__1",
  },
};
assert({ actual, expect });
