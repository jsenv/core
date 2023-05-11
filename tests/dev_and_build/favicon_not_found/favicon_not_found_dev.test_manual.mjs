// Without ui the favicon request is not sent
// and it's more complex to launch browser ui in github workflow
// so we'll keep this as manual test for now

import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

let warnCalls = [];
const warn = console.warn;
console.warn = (...args) => {
  warnCalls.push(args.join(""));
};

try {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
  });
  const { consoleOutput } = await executeInBrowser({
    url: `${devServer.origin}/main.html`,
    collectConsole: true,
    headless: false,
    pageFunction: async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    },
  });
  const actual = {
    warnCalls,
    consoleErrors: consoleOutput.errors,
  };
  const expected = {
    warnCalls: [],
    consoleErrors: [
      `Failed to load resource: the server responded with a status of 404 (no entry on filesystem)`,
    ],
  };
  assert({ actual, expected });
} finally {
  console.warn = warn;
}
