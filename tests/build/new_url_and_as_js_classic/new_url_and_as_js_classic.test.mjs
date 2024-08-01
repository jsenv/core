import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { copyFileSync } from "@jsenv/filesystem";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.js?as_js_classic": "main.js" },
      assetsDirectory: "foo/",
      runtimeCompat: { chrome: "66" },
      bundling: false,
      minification: false,
      plugins: [jsenvPluginAsJsClassic()],
    }));
});

copyFileSync({
  from: new URL("./client/main.html", import.meta.url),
  to: new URL("./main.html", `${dirUrlMap.get("0_basic")}build/`),
  overwrite: true,
});
const actual = await executeBuildHtmlInBrowser(
  `${dirUrlMap.get("0_basic")}build/`,
);
const expect = `window.origin/foo/other/file.txt?v=ead31da8`;
assert({ actual, expect });
