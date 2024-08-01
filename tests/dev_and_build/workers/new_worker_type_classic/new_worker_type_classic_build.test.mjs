import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  const testParams = {
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    minification: false,
    transpilation: {
      // topLevelAwait: "ignore",
    },
  };
  test("0_basic", () =>
    build({
      ...testParams,
    }));
  test("1_no_bundling", () =>
    build({
      ...testParams,
      bundling: false,
    }));
});

const actual = {
  basic: await executeBuildHtmlInBrowser(`${dirUrlMap.get("0_basic")}build/`),
  noBundling: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_no_bundling")}build/`,
  ),
};
const expect = {
  basic: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
  noBundling: {
    workerResponse: "pong",
    worker2Response: "pong",
  },
};
assert({ actual, expect });
