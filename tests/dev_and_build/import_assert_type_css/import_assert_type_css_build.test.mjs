import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const expectedBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  const { buildManifest } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const actualBuildSnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  compareSnapshots(actualBuildSnapshot, expectedBuildSnapshot);

  const server = await startFileServer({
    rootDirectoryUrl: snapshotDirectoryUrl,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = {
    bodyBackgroundColor: "rgb(255, 0, 0)",
    bodyBackgroundImage: `url("${server.origin}/${buildManifest["other/jsenv.png"]}")`,
  };
  assert({ actual, expected });
};

// chrome 60 cannot use <script type="module"> nor constructable stylesheet
await test({
  name: "0_js_module_fallback",
  runtimeCompat: { chrome: "60" },
  minification: false,
});
// chrome 60 + no bundling
await test({
  name: "1_js_module_fallback_no_bundling",
  runtimeCompat: { chrome: "60" },
  bundling: false,
  minification: false,
});
// chrome 88 has constructables stylesheet
// but cannot use js modules due to versioning via importmap (as it does not have importmap)
await test({
  name: "2_js_module_fallback_css_minified",
  runtimeCompat: { chrome: "88" },
  minification: {
    js_module: false,
    js_classic: false,
    css: true,
  },
});
// chrome 89 can use js modules
await test({
  name: "3_js_module",
  runtimeCompat: { chrome: "89" },
  minification: false,
});
