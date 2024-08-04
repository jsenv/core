import { assert } from "@jsenv/assert";
import { writeFileSync } from "@jsenv/filesystem";
import { replaceFluctuatingValues, takeFileSnapshot } from "@jsenv/snapshot";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

let warnCalls = [];
const warn = console.warn;
console.warn = (...args) => {
  warnCalls.push(args.join(""));
};
const sourceDirectoryUrl = new URL("./client/", import.meta.url);
try {
  const devServer = await startDevServer({
    logLevel: "warn",
    serverLogLevel: "warn",
    sourceDirectoryUrl,
    keepProcessAlive: false,
    port: 0,
  });
  const { returnValue, pageErrors, consoleOutput } = await executeInBrowser(
    `${devServer.origin}/main.html`,
    {
      collectConsole: true,
      collectErrors: true,
      /* eslint-disable no-undef */
      pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
      /* eslint-enable no-undef */
    },
  );
  const serverWarnings = warnCalls
    .map((warnCall) => replaceFluctuatingValues(warnCall))
    .join("\n");
  const serverWarningsFileUrl = new URL(
    "./output/server_warnings.txt",
    import.meta.url,
  );
  const serverWarningsSnapshot = takeFileSnapshot(serverWarningsFileUrl);
  writeFileSync(serverWarningsFileUrl, serverWarnings);
  serverWarningsSnapshot.compare();

  const actual = {
    pageErrors,
    consoleLogs: consoleOutput.logs,
    consoleErrors: consoleOutput.errors,
    errorMessage: returnValue.executionResults["/main.js"].exception.message,
  };
  const expect = {
    pageErrors: [],
    consoleLogs: [],
    consoleErrors: [
      `Failed to load resource: the server responded with a status of 404 (no entry on filesystem)`,
    ],
    errorMessage: `Error while loading module`,
  };
  assert({ actual, expect });
} finally {
  console.warn = warn;
}
