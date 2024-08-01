/*
 * Test that js module referenced by a worker use versioned urls
 * as importmap are not supported in workers
 */

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
  test("0_importmap", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "89" },
    }));
  test("1_importmap_fallback", () =>
    build({
      ...testParams,
      runtimeCompat: { chrome: "88" },
    }));
});

const actual = {
  importmap: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("0_importmap")}build/`,
  ),
  importmapFallback: await executeBuildHtmlInBrowser(
    `${dirUrlMap.get("1_importmap_fallback")}build/`,
  ),
};
const expect = {
  importmap: { ping: "pong", workerResponse: "pong" },
  importmapFallback: { ping: "pong", workerResponse: "pong" },
};
assert({ actual, expect });
