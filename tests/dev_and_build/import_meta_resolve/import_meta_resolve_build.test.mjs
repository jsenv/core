import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    versioning: false,
  };

  test("0_import_meta_resolve", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "107" }, // import.meta.resolve supported
    }));
  test("1_import_meta_resolve_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "80" }, // module supported but import.meta.resolve is not
    }));
  test("2_js_module_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "60" },
    }));
});

const actual = {
  importMetaResolveResult: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_import_meta_resolve")}build/`,
  ),
  importMetaResolveFallbackResult: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_import_meta_resolve_fallback")}build/`,
  ),
  jsModuleFallbackResult: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("2_js_module_fallback")}build/`,
  ),
};
const expect = {
  importMetaResolveResult: {
    importMetaResolveReturnValue: `window.origin/js/foo.js`,
    __TEST__: `window.origin/js/foo.js`,
  },
  importMetaResolveFallbackResult: {
    importMetaResolveReturnValue: `window.origin/js/foo.js`,
    __TEST__: `window.origin/js/foo.js`,
  },
  jsModuleFallbackResult: {
    importMetaResolveReturnValue: `window.origin/js/foo.js`,
    __TEST__: `window.origin/js/foo.js`,
  },
};
assert({ actual, expect });
