import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async ({ name, expectedUrl, ...rest }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
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
  expectedUrl: "/js/main.js?v=c94dccd3",
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
});
// cannot use <script type="module">
await test({
  name: "1_js_module_fallback",
  expectedUrl: "/js/main.nomodule.js?v=6eff77d7",
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
});
// cannot use + no bundling
await test({
  name: "2_js_module_fallback_no_bundling",
  expectedUrl: `/js/main.nomodule.js?v=4306fe4e`,
  runtimeCompat: { chrome: "60" },
});
