import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () =>
    build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      runtimeCompat: { chrome: "89" },
      bundling: false,
      minification: false,
      versioning: false,
    }));
});

const actual = {
  jsModuleResult: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_js_module")}build/`,
  ),
};
const expect = {
  jsModuleResult: `window.origin/main.html#toto`,
};
assert({ actual, expect });
