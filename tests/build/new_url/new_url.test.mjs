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
const expectResult = {
  textFileUrl: `window.origin/other/file.txt?v=268b0aca`,
  absoluteUrl: `http://example.com/file.txt`,
  windowLocationRelativeUrl: `window.origin/other/file.txt?v=268b0aca`,
  windowOriginRelativeUrl: `window.origin/other/file.txt?v=268b0aca`,
  absoluteBaseUrl: `http://jsenv.dev/file.txt`,
};
const expect = {
  jsModuleResult: { ...expectResult },
  jsModuleFallbackResult: { ...expectResult },
};
assert({ actual, expect });
