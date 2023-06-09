import { readFileSync, writeFileSync } from "node:fs";
import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
  await build({
    logLevel: "debug",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js?js_module_fallback",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/build/${name}/`, import.meta.url),
  );
  writeFileSync(
    new URL("./dist/main.html", import.meta.url),
    readFileSync(new URL("./client/main.html", import.meta.url)),
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
    typeofCurrentScript: "object",
    answer: 42,
    url: `${server.origin}/main.js?js_module_fallback`,
  };
  assert({ actual, expected, context: name });
};

// support for <script type="module"> + no versioning
await test({
  name: "0_supported_no_versioning",
  runtimeCompat: { chrome: "89" },
  versioning: false,
  plugins: [jsenvPluginBundling()],
});
// support for <script type="module">
// await test({
//   name: "1_supported",
//   runtimeCompat: { chrome: "89" },
//   plugins: [jsenvPluginBundling()],
// });
// // support for <script type="module"> + no bundling
// await test({
//   name: "2_supported_no_bundling",
//   runtimeCompat: { chrome: "89" },
// });
// // without support for <script type="module">
// await test({
//   name: "3_not_supported",
//   runtimeCompat: { chrome: "55" },
//   plugins: [jsenvPluginBundling()],
// });
