import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { launchBrowserPage } from "@jsenv/core/tests/launch_browser_page.js";
import { chromium } from "playwright";

import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

const debug = false; // true to have browser UI + keep it open after test
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: false,
  plugins: [jsenvPluginAsJsClassic()],
  port: 0,
});
const browser = await chromium.launch({ headless: !debug });
try {
  const page = await launchBrowserPage(browser);
  await page.goto(`${devServer.origin}/main.html`);

  {
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.askPromise,
      /* eslint-enable no-undef */
    );
    const expect = 42;
    assert({ actual, expect });
  }
} finally {
  if (!debug) {
    browser.close();
  }
}
