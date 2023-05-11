import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  await build({
    logLevel: "error",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    // versioning: false,
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
await test({ runtimeCompat: { chrome: "64" } });
// no support for <script type="module"> + no bundling
await test({ runtimeCompat: { chrome: "60" } });
