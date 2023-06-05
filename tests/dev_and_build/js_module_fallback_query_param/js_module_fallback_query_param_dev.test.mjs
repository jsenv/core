import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
});
const { returnValue } = await executeInBrowser({
  url: `${devServer.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
});
const actual = returnValue;
const expected = {
  typeofCurrentScript: "object",
  answer: 42,
  url: `${devServer.origin}/main.js?js_module_fallback`,
};
assert({ actual, expected });
