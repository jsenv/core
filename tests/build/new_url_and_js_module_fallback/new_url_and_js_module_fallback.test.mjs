import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";

const run = () => {
  return build({
    sourceDirectoryUrl: import.meta.resolve("./client/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: {
      "./main.html": {
        bundling: false,
        minification: false,
        runtimeCompat: { chrome: "60" },
      },
    },
  });
};

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () => run());
});

const actual = {
  basic: await executeBuildHtmlInBrowser(`${dirUrlMap.get("0_basic")}build/`),
};
const expect = {
  basic: `window.origin/other/file.txt?v=ead31da8`,
};
assert({ actual, expect });
