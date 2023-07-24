import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, expectedUrl, ...rest }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    versioning: false,
    ...rest,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
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
    answer: 42,
    url: `${server.origin}${expectedUrl}`,
  };
  assert({ actual, expected });
};

// can use <script type="module">
await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
  expectedUrl: "/main.html",
});
// cannot use <script type="module">
// await test({
//   name: "1_js_module_fallback",
//   runtimeCompat: { chrome: "60" },
//   plugins: [jsenvPluginBundling()],
//   expectedUrl: "/main.html__inline_script__1",
// });
// // cannot use <script type="module"> + no bundling
// await test({
//   runtimeCompat: { chrome: "60" },
//   expectedUrl: "/main.html__inline_script__1",
// });
// // cannot use <script type="module"> + no bundling + versioning
// await test({
//   runtimeCompat: { chrome: "60" },
//   versioning: true,
//   expectedUrl: "/main.html__inline_script__1",
// });
