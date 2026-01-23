import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { copyFileSync, replaceFileStructureSync } from "@jsenv/filesystem";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const run = () => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.js?as_js_classic": {
        assetsDirectory: "foo/",
        runtimeCompat: { chrome: "66" },
        bundling: false,
        minification: false,
        plugins: [jsenvPluginAsJsClassic()],
      },
    },
  });
};

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});

replaceFileStructureSync({
  from: new URL(`${dirUrlMap.get("0_basic")}build/`),
  to: new URL("./git_ignored/", import.meta.url),
});
copyFileSync({
  from: new URL("./client/main.html", import.meta.url),
  to: new URL("./git_ignored/main.html", import.meta.url),
  overwrite: true,
});
const actual = await executeBuildHtmlInBrowser(
  new URL("./git_ignored/", import.meta.url),
);
const expect = `window.origin/foo/other/file.txt?v=ead31da8`;
assert({ actual, expect });
