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
      runtimeCompat: { chrome: "60" },
    }));
});

const actual = {
  jsModuleResult: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_js_module")}build/`,
  ),
  jsModuleFallbackResult: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_js_module_fallback")}build/`,
  ),
};
const expect = {
  jsModuleResult: {
    meta: {
      url: `window.origin/js/main.js`,
      resolve: undefined,
    },
    url: `window.origin/js/main.js`,
    urlDestructured: `window.origin/js/main.js`,
    importMetaDev: undefined,
    importMetaTest: undefined,
    importMetaBuild: true,
  },
  jsModuleFallbackResult: {
    meta: {
      url: `window.origin/js/main.nomodule.js`,
      resolve: undefined,
    },
    url: `window.origin/js/main.nomodule.js`,
    urlDestructured: `window.origin/js/main.nomodule.js`,
    importMetaDev: undefined,
    importMetaTest: undefined,
    importMetaBuild: true,
  },
};
assert({ actual, expect });
