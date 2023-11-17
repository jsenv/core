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
    port: 0,
    ...params,
  });
  const { returnValue, pageErrors, consoleOutput } = await executeInBrowser({
    collectErrors: true,
    collectConsole: true,
    url: `${devServer.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
    /* eslint-enable no-undef */
  });
  const actual = {
    pageErrors,
    errorMessage: returnValue.executionResults["/main.js"].exception.message,
    consoleOutputRaw: consoleOutput.raw,
  };
  const expected = {
    pageErrors: [
      Object.assign(
        new Error(
          `The requested module '/file.js' does not provide an export named 'answer'`,
        ),
        {
          name: "SyntaxError",
        },
      ),
    ],
    errorMessage: `Uncaught SyntaxError: The requested module '/file.js' does not provide an export named 'answer'`,
    consoleOutputRaw: "",
  };
  assert({ actual, expected });
};

await test();
