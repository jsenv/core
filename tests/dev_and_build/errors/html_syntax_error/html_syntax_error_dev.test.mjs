import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  let consoleErrorCalls = [];
  const error = console.error;
  console.error = (...args) => {
    consoleErrorCalls.push(args.join(""));
  };
  try {
    const sourceDirectoryUrl = new URL("./client/", import.meta.url);
    const devServer = await startDevServer({
      logLevel: "error",
      sourceDirectoryUrl,
      keepProcessAlive: false,
      clientAutoreload: {
        clientServerEventsConfig: {
          logs: false,
        },
      },
      ...params,
    });
    const htmlServerUrl = `${devServer.origin}/main.html`;
    const htmFileUrl = new URL("./main.html", sourceDirectoryUrl).href;
    const { pageErrors, consoleOutput } = await executeInBrowser({
      url: htmlServerUrl,
      collectConsole: true,
      collectErrors: true,
    });
    const actual = {
      consoleErrorOutput: consoleErrorCalls.join("\n"),
      pageErrors,
      consoleOutputRaw: consoleOutput.raw,
    };
    const expected = {
      consoleErrorOutput: `Error while handling ${htmlServerUrl}:
invalid-first-character-of-tag-name
${htmFileUrl}:4:12
  3 |   <body>
> 4 |     <pre>
               ^
  5 |       foo <=> baz;`,
      pageErrors: [],
      consoleOutputRaw: "",
    };
    assert({ actual, expected });
  } finally {
    console.error = error;
  }
};

await test();
