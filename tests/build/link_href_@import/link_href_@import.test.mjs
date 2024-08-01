import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const { getScenarioBuildUrl } = await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      runtimeCompat: { chrome: "89" },
      minification: false,
    };
    test("0_versioning", () =>
      build({
        ...testParams,
        versioning: true,
      }));
    test("1_versioning_disabled", () =>
      build({
        ...testParams,
        versioning: false,
      }));
  },
);

const actual = {
  versioningResult: await executeBuildHtmlInBrowser(
    getScenarioBuildUrl("0_versioning"),
  ),
  versioningDisabledResult: await executeBuildHtmlInBrowser(
    getScenarioBuildUrl("1_versioning_disabled"),
  ),
};
const expect = {
  versioningResult: { bodyBackgroundColor: "rgb(255, 0, 0)" },
  versioningDisabledResult: { bodyBackgroundColor: "rgb(255, 0, 0)" },
};
assert({ actual, expect });
