import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

await snapshotBuildTests(
  ({ test }) => {
    test("0_basic", () =>
      build({
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: { "./main.html": "main.html" },
        bundling: false,
        minification: false,
      }));
  },
  new URL("./output/script_classic_and_sourcemap.md", import.meta.url),
);
const actual = await executeBuildHtmlInBrowser(
  new URL("./output/0_basic/build/", import.meta.url),
);
const expect = 42;
assert({ actual, expect });
