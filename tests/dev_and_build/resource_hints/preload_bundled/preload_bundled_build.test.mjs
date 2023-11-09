import { assert } from "@jsenv/assert";
import stripAnsi from "strip-ansi";

import { build, startBuildServer } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const warnCalls = [];
console.warn = (...args) => {
  warnCalls.push(stripAnsi(args.join("")));
};

const test = async ({ name, ...params }) => {
  warnCalls.length = 0;
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
  const { returnValue, consoleOutput } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.resultPromise,
    /* eslint-enable no-undef */
    collectConsole: true,
  });
  const actual = {
    warnCalls,
    returnValue,
    consoleLogs: consoleOutput.logs,
    consoleWarnings: consoleOutput.warnings,
  };
  const expected = {
    warnCalls: [
      `⚠ remove resource hint on "${
        new URL("./client/file.js", import.meta.url).href
      }" because it was bundled`,
    ],
    returnValue: 42,
    consoleLogs: ["42"],
    consoleWarnings: [],
  };
  assert({ actual, expected });
};

// window does not support unicode, it would make assertion on console.warn calls
// fail (we could write some specific code for unicode but I prefer to keep test simple)
if (process.platform !== "win32") {
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
}
