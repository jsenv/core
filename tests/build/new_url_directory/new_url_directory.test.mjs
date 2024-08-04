import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";
import { readFileSync } from "@jsenv/filesystem";

const run = ({ directoryReferenceEffect }) => {
  return build({
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./build/", import.meta.url),
    entryPoints: { "./main.html": "main.html" },
    bundling: false,
    minification: false,
    runtimeCompat: { chrome: "98" },
    assetManifest: true,
    referenceAnalysis: {
      directoryReferenceEffect,
    },
  });
};

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_error", () =>
    run({
      directoryReferenceEffect: "error",
    }));
  test("1_copy", () =>
    run({
      directoryReferenceEffect: "copy",
    }));
});

const buildManifest = readFileSync(
  `${dirUrlMap.get("1_copy")}build/asset-manifest.json`,
);
const actual = {
  copy: await executeBuildHtmlInBrowser(`${dirUrlMap.get("1_copy")}build/`),
};
const expect = {
  copy: `window.origin/${buildManifest["src/"]}`,
};
assert({ actual, expect });
