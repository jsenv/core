import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_basic", () =>
    build({
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./src/main.html": "index.html" },
      bundling: false,
      minification: false,
    }));
});

const actual = await executeBuildHtmlInBrowser(
  new URL("./output/0_basic/build/", import.meta.url),
  "index.html",
);
const expect = 42;
assert({ actual, expect });
