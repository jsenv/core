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
    keepProcessAlive: false,
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
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
    returnValue: 42,
    consoleLogs: [],
    consoleWarnings: [],
  };
  assert({ actual, expected });
};

// support for <script type="module">
await test("0_js_module", {
  runtimeCompat: { chrome: "89" },
});
// no support for <script type="module">
await test("1_js_module_fallback", {
  runtimeCompat: { chrome: "60" },
  versioningMethod: "filename",
});
