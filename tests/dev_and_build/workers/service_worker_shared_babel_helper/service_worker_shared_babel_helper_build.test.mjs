import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = () => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    versioning: true,
    runtimeCompat: {
      chrome: "55",
      edge: "14",
      firefox: "52",
      safari: "11",
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
  basic: { answer: 42 },
};
assert({ actual, expect });
