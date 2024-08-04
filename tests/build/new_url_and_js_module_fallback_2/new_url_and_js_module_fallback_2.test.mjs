import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const run = () => {
  return build({
    logLevel: "debug",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    runtimeCompat: { chrome: "60" },
  });
};

const { dirUrlMap } = await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    test("0_basic", () => run());
  },
  {
    logs: false,
    filesystemEffects: false,
  },
);

const actual = {
  basic: await executeBuildHtmlInBrowser(`${dirUrlMap.get("0_basic")}build/`),
};
const expect = {
  basic: `window.origin/js/main.nomodule.js?v=9798f172`,
};
assert({ actual, expect });
