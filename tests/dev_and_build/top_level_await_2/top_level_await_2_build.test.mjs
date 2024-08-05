import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

if (process.platform !== "darwin") {
  process.exit(0);
  // on linux the error stack is different
  // TODO: fix this one day
}
const run = ({ runtimeCompat, versioning }) => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    runtimeCompat,
    versioning,
  });
};

const { dirUrlMap } = await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_top_level_await", () =>
      run({
        runtimeCompat: { chrome: "89" },
      }));
    test("1_top_level_await_fallback", () =>
      run({
        runtimeCompat: { chrome: "55" },
      }));
    // support for <script type="module"> but not TLA
    // Considering that TLA + export on old runtimes is not recommended:
    // - TLA should be reserved to entry points where exports are not needed)
    // - It would be overkill to use systemjs only because code uses TLA + export
    // -> Jsenv throw an error when TLA + exports is used and systemjs is not
    // (ideally jsenv would throw a custom error explaining all this)
    test("2_top_level_await_throw", () =>
      run({
        runtimeCompat: { chrome: "65" },
        versioning: false,
      }));
  },
  {
    errorTransform: (error) => {
      error.stack = "";
      delete error.cause;
    },
  },
);

const actual = {
  topLevelAwait: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_top_level_await")}build/`,
  ),
  topLevelAwaitFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_top_level_await_fallback")}build/`,
  ),
};
const expect = {
  topLevelAwait: [
    "a_before_timeout",
    "a_after_timeout",
    "before_import_a",
    "after_import_a",
  ],
  topLevelAwaitFallback: [
    "a_before_timeout",
    "a_after_timeout",
    "before_import_a",
    "after_import_a",
  ],
};
assert({ actual, expect });
