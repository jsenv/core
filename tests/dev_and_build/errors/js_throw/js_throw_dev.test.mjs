import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    clientAutoreload: {
      clientServerEventsConfig: {
        logs: false,
      },
    },
    ...params,
  });
  const { returnValue, pageErrors, consoleOutput } = await executeInBrowser({
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
    /* eslint-enable no-undef */
    collectConsole: true,
    collectErrors: true,
  });
  const errorStack =
    returnValue.executionResults["/main.js"].exception.stackTrace;
  const actual = {
    errorStack,
    pageErrors,
    consoleOutputRaw: consoleOutput.raw,
  };
  const expected = {
    errorStack: `    at triggerError (${devServer.origin}/trigger_error.js:2:9)
    at ${devServer.origin}/main.js:3:1`,
    pageErrors: [
      Object.assign(new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"), {
        name: "Error",
      }),
    ],
    consoleOutputRaw: "",
  };
  assert({ actual, expected });
};

await test();
