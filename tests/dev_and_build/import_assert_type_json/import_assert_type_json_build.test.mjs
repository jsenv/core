import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
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
    new URL(`./dist/`, import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
  });
  const actual = returnValue;
  const expected = {
    data: { answer: 42 },
  };
  assert({ actual, expected });
};

// support for <script type="module">
await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  minification: false,
});
// support for <script type="module"> + no bundling
await test({
  name: "1_js_module_no_bundling",
  runtimeCompat: { chrome: "89" },
  bundling: false,
  minification: false,
});
// no support <script type="module">
await test({
  name: "2_js_module_fallback",
  runtimeCompat: { chrome: "60" },
  minification: false,
});
// no support <script type="module"> and no bundling
await test({
  name: "3_js_module_fallback_no_bundling",
  runtimeCompat: { chrome: "60" },
  bundling: false,
  minification: false,
});
