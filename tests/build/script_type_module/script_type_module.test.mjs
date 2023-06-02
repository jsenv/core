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
    versioning: false,
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
  name: "chrome_89",
  expectedUrl: "/js/main.js",
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
});
// cannot use <script type="module">
await test({
  name: "chrome_60",
  expectedUrl: "/js/main.nomodule.js",
  runtimeCompat: { chrome: "60" },
  plugins: [jsenvPluginBundling()],
});
// cannot use + no bundling
await test({
  name: "chrome_60_no_bundling",
  expectedUrl: `/js/main.nomodule.js`,
  runtimeCompat: { chrome: "60" },
});
