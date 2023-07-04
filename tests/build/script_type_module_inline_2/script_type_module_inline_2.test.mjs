import { assert } from "@jsenv/assert";

import { build, startBuildServer } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (name, params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
  const server = await startBuildServer({
    logLevel: "warn",
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
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
  const expected = { answer: 42 };
  assert({ actual, expected });
};

// support for <script type="module">
await test("0_supported", {
  runtimeCompat: { chrome: "89" },
});
// no support for <script type="module">
await test("1_not_supported", {
  runtimeCompat: { chrome: "64" },
});
// no support <script type="module"> + sourcemap as file
await test("2_not_supported_sourcemap_as_file", {
  runtimeCompat: { chrome: "60" },
  // At some point generating sourcemap in this scenario was throwing an error
  // because the sourcemap for js module files where not generated
  // and in the end code was expecting to find sourcemapUrlInfo.content
  // What should happen instead is that js modules files are gone, so their sourcemap
  // should not appear in the url graph.
  // We generate sourcemap here to ensure there won't be a regression on that
  sourcemaps: "file",
});
