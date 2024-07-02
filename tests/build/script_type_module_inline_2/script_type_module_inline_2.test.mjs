import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build, startBuildServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
  const snapshotDirectoryUrl = new URL(`./snapshots/${name}/`, import.meta.url);
  const buildDirectorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: snapshotDirectoryUrl,
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  if (!params.sourcemaps) {
    buildDirectorySnapshot.compare();
  }

  const server = await startBuildServer({
    logLevel: "warn",
    buildDirectoryUrl: snapshotDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expect = { answer: 42 };
  assert({ actual, expect });
};

// support for <script type="module">
await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  bundling: false,
  minification: false,
});
// no support for <script type="module">
await test({
  name: "1_js_module_fallback",
  runtimeCompat: { chrome: "64" },
  bundling: false,
  minification: false,
});
// no support <script type="module"> + sourcemap as file
await test({
  name: "2_js_module_fallback_and_sourcemap_as_file",
  runtimeCompat: { chrome: "60" },
  // At some point generating sourcemap in this scenario was throwing an error
  // because the sourcemap for js module files where not generated
  // and in the end code was expecting to find sourcemapUrlInfo.content
  // What should happen instead is that js modules files are gone, so their sourcemap
  // should not appear in the url graph.
  // We generate sourcemap here to ensure there won't be a regression on that
  sourcemaps: "file",
  bundling: false,
  minification: false,
});
