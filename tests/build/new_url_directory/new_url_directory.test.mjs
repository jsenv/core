import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { readFileSync } from "@jsenv/filesystem";

const { getScenarioBuildUrl } = await snapshotBuildTests(
  import.meta.url,
  ({ test }) => {
    const testParams = {
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./build/", import.meta.url),
      entryPoints: { "./main.html": "main.html" },
      bundling: false,
      minification: false,
      runtimeCompat: { chrome: "98" },
      assetManifest: true,
    };

    test("0_error", () =>
      build({
        ...testParams,
        directoryReferenceEffect: "error",
      }));
    test("1_copy", () =>
      build({
        ...testParams,
        directoryReferenceEffect: "copy",
      }));
  },
);

const buildManifest = readFileSync(
  new URL("./asset-manifest.json", getScenarioBuildUrl("1_copy")),
);
const actual = await executeBuildHtmlInBrowser(getScenarioBuildUrl("1_copy"));
const expect = `window.origin/${buildManifest["src/"]}`;
assert({ actual, expect });
