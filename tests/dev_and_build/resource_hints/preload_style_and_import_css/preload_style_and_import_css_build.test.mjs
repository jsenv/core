import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build, startBuildServer } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (name, params) => {
  await build({
    logLevel: "error",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
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
  const { returnValue, consoleOutput } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
    collectConsole: true,
  });
  const actual = {
    returnValue,
    consoleOutputRaw: consoleOutput.raw,
  };
  const expected = {
    returnValue: "20px",
    consoleOutputRaw: "",
  };
  assert({ actual, expected });
};

// support for <script type="module">
await test("0_js_module", {
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginBundling()],
  versioning: false,
});
// no support for <script type="module"> + no bundling
await test("1_js_module_fallback", {
  runtimeCompat: { chrome: "62" },
  versioning: false,
});
