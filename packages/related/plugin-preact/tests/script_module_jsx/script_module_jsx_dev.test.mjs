import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins: [jsenvPluginPreact()],
  port: 0,
});
const { returnValue } = await executeInBrowser(`${devServer.origin}/main.html`);
const actual = returnValue;
const expect = "Hello world";
assert({ actual, expect });
