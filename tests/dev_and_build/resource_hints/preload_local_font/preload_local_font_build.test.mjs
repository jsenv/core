import { takeDirectorySnapshotAndCompare } from "@jsenv/snapshot";
import { assert } from "@jsenv/assert";

import { build, startBuildServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async ({ name, ...params }) => {
  await build({
    logLevel: "error",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshotAndCompare(
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
    consoleLogs: consoleOutput.logs,
    consoleWarnings: consoleOutput.warnings,
  };
  const expected = {
    returnValue: "Roboto",
    consoleLogs: [],
    consoleWarnings: [],
  };
  assert({ actual, expected });
};

// support for <script type="module">
await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  minification: false,
});
// no support for <script type="module">
await test({
  name: "1_js_module_fallback",
  runtimeCompat: { chrome: "60" },
  minification: false,
});
