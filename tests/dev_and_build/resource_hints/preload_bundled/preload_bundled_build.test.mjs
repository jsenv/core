import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const warnCalls = [];
console.warn = (...args) => {
  warnCalls.push(args.join(""));
};

const test = async (params) => {
  warnCalls.length = 0;
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    plugins: [jsenvPluginBundling()],
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
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
      `remove resource hint on "${
        new URL("./client/file.js", import.meta.url).href
      }" because it was bundled`,
    ],
    returnValue: 42,
    consoleLogs: ["42"],
    consoleWarnings: [],
  };
  assert({ actual, expected });
};

// support for <script type="module">
await test({ runtimeCompat: { chrome: "89" } });
// no support for <script type="module">
await test({ runtimeCompat: { chrome: "60" } });
