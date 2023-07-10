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
    collectConsole: true,
    collectErrors: true,
    /* eslint-disable no-undef */
    pageFunction: () => window.__supervisor__.getDocumentExecutionResult(),
    /* eslint-enable no-undef */
  });
  const errorText = returnValue.executionResults["/main.js"].exception.text;
  const actual = {
    pageErrors,
    errorText,
    consoleOutputRaw: consoleOutput.raw,
  };
  const expected = {
    pageErrors: [
      Object.assign(new Error("Unexpected end of input"), {
        name: "SyntaxError",
      }),
    ],
    errorText: "Unexpected end of input",
    consoleOutputRaw: "",
  };
  assert({ actual, expected });
};

await test();
