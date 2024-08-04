import { assert } from "@jsenv/assert";
import { chromium, firefox } from "playwright";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const test = async ({ browserLauncher }) => {
  const { returnValue } = await executeInBrowser(
    `${devServer.origin}/main.html`,
    { browserLauncher },
  );
  const actual = returnValue;
  const expect = {
    importMetaResolveReturnValue: `window.origin/node_modules/foo/foo.js?js_classic&v=0.0.1`,
    __TEST__: `window.origin/node_modules/foo/foo.js?js_classic&v=0.0.1`,
  };
  assert({ actual, expect });
};

await test({ browserLauncher: chromium });
if (
  // page.goto: NS_ERROR_CONNECTION_REFUSED happens a lot with windows here
  process.platform !== "win32"
) {
  await test({ browserLauncher: firefox });
}
