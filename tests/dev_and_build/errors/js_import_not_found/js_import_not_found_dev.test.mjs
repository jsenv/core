import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

let warnCalls = [];
const warn = console.warn;
console.warn = (...args) => {
  warnCalls.push(args.join(""));
};
try {
  const sourceDirectoryUrl = new URL("./client/", import.meta.url);
  const devServer = await startDevServer({
    logLevel: "warn",
    serverLogLevel: "warn",
    sourceDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  });
  const { returnValue, pageErrors, consoleOutput } = await executeInBrowser({
    url: `${devServer.origin}/main.html`,
    collectConsole: true,
    collectErrors: true,
    /* eslint-disable no-undef */
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
    /* eslint-enable no-undef */
  });

  const actual = {
    serverWarnOutput: warnCalls.join("\n"),
    pageErrors,
    consoleLogs: consoleOutput.logs,
    consoleErrors: consoleOutput.errors,
    errorMessage: returnValue.executionResults["/main.js"].exception.message,
  };
  const expected = {
    serverWarnOutput: `GET ${devServer.origin}/not_found.js
  [33m404[0m Failed to fetch url content
  --- reason ---
  no entry on filesystem
  --- url ---
  ${sourceDirectoryUrl}not_found.js
  --- url reference trace ---
  ${sourceDirectoryUrl}intermediate.js:2:7
  1 | // eslint-disable-next-line import/no-unresolved
  2 | import "./not_found.js";
            ^
  --- plugin name ---
  "jsenv:file_url_fetching"`,
    pageErrors: [],
    consoleLogs: [],
    consoleErrors: [
      `Failed to load resource: the server responded with a status of 404 (no entry on filesystem)`,
    ],
    errorMessage: `Error while loading module`,
  };
  assert({ actual, expected });
} finally {
  console.warn = warn;
}
