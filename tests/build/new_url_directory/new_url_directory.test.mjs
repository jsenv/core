import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { readFileSync } from "@jsenv/filesystem";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
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
});

const buildManifest = readFileSync(
  `${dirUrlMap.get("1_copy")}build/asset-manifest.json`,
);
const actual = await executeBuildHtmlInBrowser(
  `${dirUrlMap.get("1_copy")}build/`,
);
const expect = `window.origin/${buildManifest["src/"]}`;
assert({ actual, expect });
