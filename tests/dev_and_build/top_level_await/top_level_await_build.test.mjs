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
  test("0_top_level_await", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
    }));
  test("1_top_level_await_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "55" },
    }));
});

const actual = {
  topLevelAwait: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_top_level_await")}build/`,
  ),
  topLevelAwaitFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_top_level_await_fallback")}build/`,
  ),
};
const expect = {
  topLevelAwait: { answer: 42 },
  topLevelAwaitFallback: { answer: 42 },
};
assert({ actual, expect });
